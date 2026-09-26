import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Banknote, CreditCard, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { COPY, type PaymentMethod, phone as phoneSchema } from '@novafood/shared';
import { useConfig } from '../../api/catalog';
import { useServerCart } from '../../api/cart';
import { usePlaceOrder } from '../../api/orders';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { PageLoader } from '../../components/States';
import { ApiError, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { useMascot } from '../../stores/mascot';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Card, Field, Input, Textarea } from '../../ui/primitives';
import { AddressModal } from '../account/AddressForm';
import { BillDetails } from '../cart/CartPage';
import { usePayForOrder } from './usePayment';

export function CheckoutPage() {
  const user = useAuth((s) => s.user)!;
  const cart = useServerCart();
  const config = useConfig();
  const place = usePlaceOrder();
  const pay = usePayForOrder();
  const navigate = useNavigate();

  const defaultAddress = user.addresses.find((a) => a.isDefault) ?? user.addresses[0];
  const [addressId, setAddressId] = useState(defaultAddress?._id ?? '');
  const [contactPhone, setContactPhone] = useState(user.phone ?? '');
  const [instructions, setInstructions] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('COD');
  const [addingAddress, setAddingAddress] = useState(false);
  const [phoneError, setPhoneError] = useState<string>();
  // Set once an order exists. Placing it empties the cart, and the empty-cart redirect below must not
  // yank the customer to /cart mid-payment or before we navigate to tracking.
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  // One key per checkout attempt: retries and double taps reuse it, so only one order is created.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!addressId && user.addresses[0]) setAddressId(user.addresses[0]._id);
  }, [user.addresses, addressId]);

  if (cart.isLoading) return <PageLoader />;
  if (!cart.data || cart.data.lines.length === 0) return placedOrderId ? <PageLoader /> : <Navigate to="/cart" replace />;
  const data = cart.data;
  const onlineAvailable = Boolean(config.data?.onlinePayments);

  const submit = async () => {
    const parsed = phoneSchema.safeParse(contactPhone);
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message);
      return;
    }
    setPhoneError(undefined);
    if (!addressId) {
      toast.error('Add a delivery address first 📍');
      return;
    }
    try {
      const result = await place.mutateAsync({ addressId, paymentMethod: method, contactPhone: parsed.data, deliveryInstructions: instructions.trim() || undefined, idempotencyKey });
      setPlacedOrderId(result.order._id);
      if (result.payment) {
        await pay(result.order, result.payment, parsed.data);
      } else {
        useMascot.getState().react('celebrate', 4000);
        toast.success(COPY.success.orderPlaced);
      }
      navigate(`/orders/${result.order._id}?placed=1`, { replace: true });
    } catch (err) {
      useMascot.getState().react('worried');
      toast.error(err instanceof ApiError && err.code === 'CART_BLOCKED' ? 'Your cart needs attention' : 'Order could not be placed', errorMessage(err));
      if (err instanceof ApiError && err.status === 422) void cart.refetch();
    }
  };

  return (
    <div className="container-nf py-8">
      <Seo title="Checkout" noindex />
      <h1 className="mb-6 text-4xl font-extrabold">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-extrabold"><MapPin className="h-5 w-5 text-brand" /> Deliver to</h2>
              <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddingAddress(true)}>Add new</Button>
            </div>
            {user.addresses.length === 0 ? (
              <button type="button" onClick={() => setAddingAddress(true)} className="w-full rounded-lg border-2 border-dashed border-line p-6 text-center font-semibold text-ink-soft hover:border-brand hover:text-brand">
                + Add your first delivery address
              </button>
            ) : (
              <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
                {user.addresses.map((a) => (
                  <label key={a._id} className={cn('cursor-pointer rounded-lg border-2 p-4 transition-colors', addressId === a._id ? 'border-brand bg-brand-soft/40 dark:bg-brand/10' : 'border-line hover:border-ink-faint')}>
                    <input type="radio" name="address" className="sr-only" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                    <p className="font-bold">{a.label}{a.isDefault ? <span className="ml-2 text-xs font-semibold text-ink-faint">Default</span> : null}</p>
                    <p className="mt-1 text-sm text-ink-soft">{[a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(', ')}</p>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Contact number" error={phoneError} hint="The kitchen or rider may call about your order">
                {(p) => <Input {...p} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" />}
              </Field>
              <Field label="Delivery instructions (optional)">
                {(p) => <Textarea {...p} value={instructions} maxLength={200} onChange={(e) => setInstructions(e.target.value)} className="min-h-12" placeholder="Gate code, leave at door…" />}
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-extrabold">Payment method</h2>
            <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
              {[
                { id: 'RAZORPAY' as const, title: 'Pay online', body: onlineAvailable ? 'UPI, cards, netbanking via Razorpay' : 'Not available on this server yet', icon: CreditCard, disabled: !onlineAvailable },
                { id: 'COD' as const, title: 'Cash on delivery', body: 'Pay the rider in cash or UPI at the door', icon: Banknote, disabled: false },
              ].map((m) => (
                <label key={m.id} className={cn('flex cursor-pointer gap-3 rounded-lg border-2 p-4', method === m.id ? 'border-brand bg-brand-soft/40 dark:bg-brand/10' : 'border-line', m.disabled && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="payment" className="sr-only" disabled={m.disabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <m.icon className="h-6 w-6 shrink-0 text-grape" aria-hidden />
                  <span>
                    <span className="block font-bold">{m.title}</span>
                    <span className="text-sm text-ink-soft">{m.body}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-faint">
              <ShieldCheck className="h-4 w-4 text-success" /> Totals are calculated and payments verified on our server. Your card details never touch NovaFood.
            </p>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            {data.restaurant ? (
              <div className="mb-4 flex items-center gap-3">
                <span className="h-11 w-11 overflow-hidden rounded-md"><FoodArt art={data.restaurant.art} rounded="rounded-md" /></span>
                <div>
                  <p className="font-bold">{data.restaurant.name}</p>
                  <Link to="/cart" className="text-sm font-semibold text-brand">Edit cart ({data.itemCount} items)</Link>
                </div>
              </div>
            ) : null}
            <ul className="mb-4 space-y-1 text-sm">
              {data.lines.map((l) => (
                <li key={l._id} className="flex justify-between gap-3">
                  <span className="truncate text-ink-soft">{l.quantity} × {l.name}</span>
                  <span>{money(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <BillDetails pricing={data.pricing} />
            {data.blockers.length ? <p role="alert" className="mt-4 rounded-md bg-warning/12 p-3 text-sm font-semibold text-warning">{data.blockers[0]}</p> : null}
            <Button size="lg" className="mt-5 w-full" loading={place.isPending} disabled={data.blockers.length > 0} onClick={submit}>
              {method === 'COD' ? `Place order · ${money(data.pricing.totalPaise)}` : `Pay ${money(data.pricing.totalPaise)}`}
            </Button>
          </Card>
        </aside>
      </div>
      <AddressModal open={addingAddress} onClose={() => setAddingAddress(false)} onSaved={(a) => setAddressId(a._id)} />
    </div>
  );
}
