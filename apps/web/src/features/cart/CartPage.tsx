import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, Sparkles, Ticket, Trash2, X } from 'lucide-react';
import { type CartDTO, COPY, type PriceBreakdown } from '@novafood/shared';
import { useCoupons } from '../../api/catalog';
import { useApplyCoupon, useClearCart, useRemoveCoupon, useServerCart, useSetUsePoints, useUpdateLine } from '../../api/cart';
import { CouponTicket } from '../../components/food/cards';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';
import { ApiError, errorMessage } from '../../lib/api';
import { money } from '../../lib/format';
import { useIsAuthed } from '../../stores/auth';
import { confirm } from '../../stores/confirm';
import { useGuestCart } from '../../stores/guestCart';
import { Button, ButtonLink } from '../../ui/Button';
import { QuantityStepper } from '../../ui/controls';
import { Card, Input, Switch, VegMark } from '../../ui/primitives';

export function BillDetails({ pricing, className }: { pricing: PriceBreakdown; className?: string }) {
  const rows: [string, number, string?][] = [
    ['Item total', pricing.itemsSubtotalPaise],
    ...(pricing.couponDiscountPaise ? ([['Coupon discount', -pricing.couponDiscountPaise, 'text-success']] as [string, number, string][]) : []),
    ...(pricing.pointsDiscountPaise ? ([[`Nova Points (${pricing.pointsRedeemed})`, -pricing.pointsDiscountPaise, 'text-success']] as [string, number, string][]) : []),
    ['Delivery fee', pricing.deliveryFeePaise],
    ['Platform fee', pricing.platformFeePaise],
    ['GST (5% on food)', pricing.gstPaise],
  ];
  return (
    <div className={className}>
      <h2 className="mb-3 font-display text-lg font-bold">Bill details</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value, cls]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-ink-soft">{label}</dt>
            <dd className={cls}>{value === 0 && label === 'Delivery fee' ? <span className="font-semibold text-success">FREE</span> : (value < 0 ? '−' : '') + money(Math.abs(value))}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
          <dt>To pay</dt>
          <dd>{money(pricing.totalPaise)}</dd>
        </div>
      </dl>
    </div>
  );
}

function CouponPanel({ cart }: { cart: CartDTO }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const coupons = useCoupons();
  const applicable = (coupons.data ?? []).filter((c) => !c.restaurantIds.length || (cart.restaurant && c.restaurantIds.includes(cart.restaurant._id)));

  const submit = (value: string) => {
    setError(null);
    apply.mutate(value, { onSuccess: () => setCode(''), onError: (err) => setError(err instanceof ApiError ? err.message : errorMessage(err)) });
  };

  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Ticket className="h-5 w-5 text-grape" /> Offers & coupons
      </h2>
      {cart.coupon ? (
        <div className="flex items-center justify-between rounded-md bg-success/10 p-3">
          <div>
            <p className="font-bold text-success">{cart.coupon.code} applied</p>
            <p className="text-sm text-ink-soft">You save {money(cart.coupon.discountPaise)} · {cart.coupon.description}</p>
          </div>
          <button type="button" aria-label="Remove coupon" onClick={() => remove.mutate()} className="rounded-full p-2 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) submit(code.trim().toUpperCase());
          }}
        >
          <label className="sr-only" htmlFor="coupon">Coupon code</label>
          <Input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" aria-invalid={error ? true : undefined} aria-describedby={error ? 'coupon-error' : undefined} />
          <Button type="submit" variant="secondary" loading={apply.isPending} disabled={!code.trim()}>
            Apply
          </Button>
        </form>
      )}
      {error || cart.couponError ? (
        <p id="coupon-error" role="alert" className="mt-2 text-sm font-medium text-danger">
          {error ?? cart.couponError}
        </p>
      ) : null}
      {!cart.coupon && applicable.length ? (
        <div className="mt-4 space-y-2">
          {applicable.slice(0, 3).map((c) => (
            <CouponTicket key={c._id} coupon={c} applying={apply.isPending} onApply={() => submit(c.code)} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ServerCart() {
  const { data: cart, isLoading } = useServerCart();
  const update = useUpdateLine();
  const clear = useClearCart();
  const usePoints = useSetUsePoints();
  const navigate = useNavigate();

  if (isLoading) return <PageLoader />;
  if (!cart || cart.lines.length === 0) {
    return <EmptyState mood="hungry" title={COPY.empty.cart.title} body={COPY.empty.cart.body} action={<ButtonLink to="/restaurants">Explore restaurants</ButtonLink>} />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            {cart.restaurant ? (
              <Link to={`/r/${cart.restaurant.slug}`} className="flex items-center gap-3">
                <span className="h-12 w-12 overflow-hidden rounded-md"><FoodArt art={cart.restaurant.art} rounded="rounded-md" /></span>
                <span>
                  <span className="block font-display text-lg font-bold">{cart.restaurant.name}</span>
                  <span className="text-sm text-ink-faint">Delivery in about {cart.restaurant.deliveryTimeMins} min</span>
                </span>
              </Link>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Clear your cart?', body: 'All items will be removed.', confirmLabel: 'Clear', danger: true })) clear.mutate();
              }}
            >
              Clear
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {cart.lines.map((line) => (
              <li key={line._id} className="flex gap-4 py-4">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md"><FoodArt art={line.art} imageUrl={line.imageUrl} width={128} rounded="rounded-md" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <VegMark veg={line.isVeg} /> {line.name}
                  </p>
                  {line.variant || line.addOns.length ? (
                    <p className="text-sm text-ink-faint">{[line.variant?.name, ...line.addOns.map((a) => a.name)].filter(Boolean).join(' · ')}</p>
                  ) : null}
                  {!line.available ? <p className="text-sm font-semibold text-danger">{COPY.error.itemUnavailable}</p> : null}
                  <input
                    aria-label={`Instructions for ${line.name}`}
                    defaultValue={line.note ?? ''}
                    maxLength={140}
                    placeholder="Add cooking instructions"
                    onBlur={(e) => e.target.value !== (line.note ?? '') && update.mutate({ lineId: line._id, note: e.target.value })}
                    className="mt-1 w-full bg-transparent text-sm text-ink-soft outline-none placeholder:text-ink-faint focus:underline"
                  />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <QuantityStepper size="sm" value={line.quantity} onChange={(q) => update.mutate({ lineId: line._id, quantity: q })} label={line.name} busy={update.isPending} />
                  <span className="font-semibold">{money(line.lineTotalPaise)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <CouponPanel cart={cart} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        {cart.pointsBalance > 0 ? (
          <Card className="p-5">
            <Switch
              checked={cart.usePoints}
              onChange={(v) => usePoints.mutate(v)}
              label={`Use Nova Points (${cart.pointsBalance} available)`}
              description={cart.usePoints && cart.pricing.pointsRedeemed === 0 ? 'Needs at least 20 points and a big enough order' : 'Up to 20% of your food value'}
            />
          </Card>
        ) : null}
        <Card className="p-5">
          <BillDetails pricing={cart.pricing} />
          {cart.pointsWillEarn > 0 ? (
            <p className="mt-4 flex items-center gap-2 rounded-md bg-lime/40 px-3 py-2 text-sm font-semibold text-[#1b0f3b]">
              <Sparkles className="h-4 w-4" /> You’ll earn {cart.pointsWillEarn} Nova Points on delivery
            </p>
          ) : null}
          {cart.blockers.length ? (
            <ul className="mt-4 space-y-2" role="alert">
              {cart.blockers.map((b) => (
                <li key={b} className="flex gap-2 rounded-md bg-warning/12 p-3 text-sm font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {b}
                </li>
              ))}
            </ul>
          ) : null}
          <Button size="lg" className="mt-5 w-full" disabled={cart.blockers.length > 0} rightIcon={<ArrowRight className="h-5 w-5" />} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </Button>
        </Card>
      </aside>
    </div>
  );
}

function GuestCart() {
  const { lines, setQuantity } = useGuestCart();
  if (lines.length === 0) {
    return <EmptyState mood="hungry" title={COPY.empty.cart.title} body={COPY.empty.cart.body} action={<ButtonLink to="/restaurants">Explore restaurants</ButtonLink>} />;
  }
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.snapshot.unitPricePaise, 0);
  const restaurant = lines[0]!.snapshot;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <Card className="p-5">
        <Link to={`/r/${restaurant.restaurantSlug}`} className="mb-4 block font-display text-lg font-bold">{restaurant.restaurantName}</Link>
        <ul className="divide-y divide-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-4 py-4">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md"><FoodArt art={l.snapshot.art} imageUrl={l.snapshot.imageUrl} width={112} rounded="rounded-md" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold"><VegMark veg={l.snapshot.isVeg} /> {l.snapshot.name}</p>
                <p className="text-sm text-ink-faint">{[l.snapshot.variantName, ...l.snapshot.addOnNames].filter(Boolean).join(' · ')}</p>
              </div>
              <QuantityStepper size="sm" value={l.quantity} onChange={(q) => setQuantity(l.key, q)} label={l.snapshot.name} />
              <span className="w-20 text-right font-semibold">{money(l.quantity * l.snapshot.unitPricePaise)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="h-fit p-5">
        <div className="flex justify-between text-lg font-bold">
          <span>Item total</span>
          <span>{money(subtotal)}</span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">Delivery, fees, taxes and coupons are calculated by the server once you log in.</p>
        <ButtonLink to="/login" state={{ from: '/cart' }} size="lg" className="mt-5 w-full">
          Log in to checkout
        </ButtonLink>
        <p className="mt-3 text-center text-sm text-ink-faint">
          New here? <Link to="/register" state={{ from: '/cart' }} className="font-semibold text-brand">Create an account</Link>
        </p>
      </Card>
    </div>
  );
}

export function CartPage() {
  const authed = useIsAuthed();
  return (
    <div className="container-nf py-8">
      <Seo title="Your cart" noindex />
      <h1 className="mb-6 text-4xl font-extrabold">Cart 🛒</h1>
      {authed ? <ServerCart /> : <GuestCart />}
    </div>
  );
}
