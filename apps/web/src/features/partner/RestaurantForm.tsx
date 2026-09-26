import { useState } from 'react';
import { CUISINES, type Cuisine, type RestaurantDTO, type RestaurantInput, WEEKDAYS, WEEKDAY_LABEL, type Weekday, restaurantInputSchema } from '@novafood/shared';
import { useConfig } from '../../api/catalog';
import { FOOD_ART_KINDS, FoodArt } from '../../components/food/FoodArt';
import { errorMessage } from '../../lib/api';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Card, Chip, Field, Input, Select, Switch, Textarea } from '../../ui/primitives';
import { uploadImage } from './api';

const rupees = (p?: number | null) => (p == null ? '' : String(p / 100));
const paise = (r: string) => Math.round(Number(r || 0) * 100);

export function RestaurantForm({ initial, submitLabel, busy, onSubmit }: { initial?: RestaurantDTO; submitLabel: string; busy?: boolean; onSubmit: (input: RestaurantInput) => void }) {
  const config = useConfig();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [cuisines, setCuisines] = useState<Cuisine[]>(initial?.cuisines ?? []);
  const [line1, setLine1] = useState(initial?.address.line1 ?? '');
  const [area, setArea] = useState(initial?.address.area ?? '');
  const [city, setCity] = useState(initial?.address.city ?? 'Bengaluru');
  const [pincode, setPincode] = useState(initial?.address.pincode ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [pureVeg, setPureVeg] = useState(initial?.pureVeg ?? false);
  const [costForTwo, setCostForTwo] = useState(rupees(initial?.costForTwoPaise ?? 50000));
  const [deliveryTime, setDeliveryTime] = useState(String(initial?.deliveryTimeMins ?? 30));
  const [deliveryFee, setDeliveryFee] = useState(rupees(initial?.deliveryFeePaise ?? 3900));
  const [freeAbove, setFreeAbove] = useState(rupees(initial?.freeDeliveryAbovePaise));
  const [minOrder, setMinOrder] = useState(rupees(initial?.minOrderPaise ?? 0));
  const [offerText, setOfferText] = useState(initial?.offerText ?? '');
  const [policies, setPolicies] = useState(initial?.policies ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [art, setArt] = useState(initial?.art ?? { kind: 'bowl', hue: 20 });
  const everyDay = !initial || new Set(initial.openingHours.map((h) => `${h.open}-${h.close}`)).size <= 1;
  const [sameHours, setSameHours] = useState(everyDay);
  const [hours, setHours] = useState<Record<Weekday, { open: string; close: string; closed: boolean }>>(() =>
    Object.fromEntries(
      WEEKDAYS.map((d) => {
        const h = initial?.openingHours.find((x) => x.day === d);
        return [d, { open: h?.open ?? '11:00', close: h?.close ?? '23:00', closed: Boolean(initial && !h) }];
      }),
    ) as Record<Weekday, { open: string; close: string; closed: boolean }>,
  );
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const openingHours = WEEKDAYS.filter((d) => sameHours || !hours[d].closed).map((d) => {
      const h = sameHours ? hours.mon : hours[d];
      return { day: d, open: h.open, close: h.close };
    });
    const input = {
      name,
      description,
      cuisines,
      address: { line1, area, city, pincode },
      phone: phone || undefined,
      pureVeg,
      costForTwoPaise: paise(costForTwo),
      deliveryTimeMins: Number(deliveryTime),
      deliveryFeePaise: paise(deliveryFee),
      freeDeliveryAbovePaise: freeAbove ? paise(freeAbove) : null,
      minOrderPaise: paise(minOrder),
      openingHours,
      offerText: offerText || undefined,
      policies: policies || undefined,
      coverUrl,
      art,
    };
    const parsed = restaurantInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join('.') || 'form'}: ${i.message}`));
      return;
    }
    setErrors([]);
    onSubmit(parsed.data);
  };

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Basics</h2>
        <div className="sm:col-span-2"><Field label="Restaurant name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Description">{(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field></div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Cuisines (up to 5)</legend>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((c) => (
              <Chip key={c} active={cuisines.includes(c)} onClick={() => setCuisines((l) => (l.includes(c) ? l.filter((x) => x !== c) : l.length < 5 ? [...l, c] : l))}>{c}</Chip>
            ))}
          </div>
        </fieldset>
        <Switch checked={pureVeg} onChange={setPureVeg} label="Pure veg kitchen" />
      </Card>

      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">Location & contact</h2>
        <div className="sm:col-span-2"><Field label="Street address">{(p) => <Input {...p} value={line1} onChange={(e) => setLine1(e.target.value)} />}</Field></div>
        <Field label="Area">{(p) => <Input {...p} value={area} onChange={(e) => setArea(e.target.value)} />}</Field>
        <Field label="City">{(p) => <Input {...p} value={city} onChange={(e) => setCity(e.target.value)} />}</Field>
        <Field label="PIN code">{(p) => <Input {...p} value={pincode} inputMode="numeric" maxLength={6} onChange={(e) => setPincode(e.target.value)} />}</Field>
        <Field label="Phone">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      </Card>

      <Card className="grid gap-4 p-6 sm:grid-cols-3">
        <h2 className="text-lg font-bold sm:col-span-3">Delivery & pricing</h2>
        <Field label="Cost for two (₹)">{(p) => <Input {...p} inputMode="decimal" value={costForTwo} onChange={(e) => setCostForTwo(e.target.value)} />}</Field>
        <Field label="Delivery time (minutes)">{(p) => <Input {...p} inputMode="numeric" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />}</Field>
        <Field label="Delivery fee (₹)">{(p) => <Input {...p} inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />}</Field>
        <Field label="Free delivery above (₹, optional)">{(p) => <Input {...p} inputMode="decimal" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} />}</Field>
        <Field label="Minimum order (₹)">{(p) => <Input {...p} inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />}</Field>
        <Field label="Offer line (optional)">{(p) => <Input {...p} value={offerText} maxLength={80} onChange={(e) => setOfferText(e.target.value)} placeholder="20% off up to ₹100" />}</Field>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold">Opening hours (IST)</h2>
        <Switch checked={sameHours} onChange={setSameHours} label="Same hours every day" description="A closing time earlier than opening runs past midnight" />
        {(sameHours ? (['mon'] as Weekday[]) : WEEKDAYS).map((d) => (
          <div key={d} className="flex flex-wrap items-center gap-3">
            <span className="w-28 font-semibold">{sameHours ? 'Every day' : WEEKDAY_LABEL[d]}</span>
            <Input type="time" aria-label={`${WEEKDAY_LABEL[d]} opening time`} value={hours[d].open} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d], open: e.target.value } }))} className="w-36" disabled={!sameHours && hours[d].closed} />
            <span>to</span>
            <Input type="time" aria-label={`${WEEKDAY_LABEL[d]} closing time`} value={hours[d].close} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d], close: e.target.value } }))} className="w-36" disabled={!sameHours && hours[d].closed} />
            {!sameHours ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hours[d].closed} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...h[d], closed: e.target.checked } }))} /> Closed
              </label>
            ) : null}
          </div>
        ))}
      </Card>

      <Card className="grid gap-4 p-6 sm:grid-cols-[200px_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg"><FoodArt art={art} imageUrl={coverUrl} /></div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Look</h2>
          {config.data?.uploads ? (
            <label className="inline-block cursor-pointer rounded-full border-2 border-line px-4 py-2 text-sm font-semibold hover:border-brand">
              {coverUrl ? 'Replace cover photo' : 'Upload cover photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setCoverUrl(await uploadImage(file, 'restaurant'));
                  } catch (err) {
                    toast.error('Upload failed', errorMessage(err));
                  }
                }}
              />
            </label>
          ) : (
            <p className="text-sm text-ink-faint">Photo uploads are not enabled on this server; pick an illustration instead.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Select aria-label="Illustration" value={art.kind} onChange={(e) => setArt({ ...art, kind: e.target.value })} className="w-44">
              {FOOD_ART_KINDS.map((k) => <option key={k}>{k}</option>)}
            </Select>
            <input aria-label="Illustration colour" type="range" min={0} max={360} value={art.hue} onChange={(e) => setArt({ ...art, hue: Number(e.target.value) })} className="accent-[var(--color-brand)]" />
          </div>
          <Field label="Policies (optional)">{(p) => <Textarea {...p} value={policies} maxLength={600} onChange={(e) => setPolicies(e.target.value)} />}</Field>
        </div>
      </Card>

      {errors.length ? (
        <ul role="alert" className="rounded-md bg-danger/10 p-4 text-sm font-semibold text-danger">
          {errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
        </ul>
      ) : null}
      <Button size="lg" onClick={submit} loading={busy}>{submitLabel}</Button>
    </div>
  );
}
