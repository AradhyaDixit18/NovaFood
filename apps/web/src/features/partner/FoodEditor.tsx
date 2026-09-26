import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ALLERGENS, CUISINES, type Cuisine, DIET_TAGS, FOOD_TAGS, type FoodDTO, type FoodInput, foodInputSchema } from '@novafood/shared';
import { useConfig } from '../../api/catalog';
import { FOOD_ART_KINDS, FoodArt } from '../../components/food/FoodArt';
import { ApiError, errorMessage } from '../../lib/api';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Chip, Field, Input, Select, Switch, Textarea } from '../../ui/primitives';
import { uploadImage, useSaveFood } from './api';

const toRupees = (p: number | null | undefined) => (p == null ? '' : String(p / 100));
const toPaise = (r: string) => (r.trim() === '' ? null : Math.round(Number(r) * 100));

type Draft = {
  name: string;
  description: string;
  section: string;
  cuisine: Cuisine;
  price: string;
  compareAt: string;
  isVeg: boolean;
  dietTags: string[];
  allergens: string[];
  tags: string[];
  spiceLevel: number;
  isAvailable: boolean;
  isBestseller: boolean;
  imageUrl: string | null;
  art: { kind: string; hue: number };
  variants: { name: string; price: string }[];
  addOnGroups: { name: string; minSelect: number; maxSelect: number; options: { name: string; price: string; isVeg: boolean }[] }[];
};

function fromFood(food: FoodDTO | null, defaultCuisine: Cuisine): Draft {
  return {
    name: food?.name ?? '',
    description: food?.description ?? '',
    section: food?.section ?? 'Mains',
    cuisine: food?.cuisine ?? defaultCuisine,
    price: toRupees(food?.pricePaise ?? null),
    compareAt: toRupees(food?.compareAtPricePaise ?? null),
    isVeg: food?.isVeg ?? true,
    dietTags: food?.dietTags ?? [],
    allergens: food?.allergens ?? [],
    tags: food?.tags ?? [],
    spiceLevel: food?.spiceLevel ?? 0,
    isAvailable: food?.isAvailable ?? true,
    isBestseller: food?.isBestseller ?? false,
    imageUrl: food?.imageUrl ?? null,
    art: food?.art ?? { kind: 'bowl', hue: 20 },
    variants: food?.variants.map((v) => ({ name: v.name, price: toRupees(v.pricePaise) })) ?? [],
    addOnGroups:
      food?.addOnGroups.map((g) => ({ name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, options: g.options.map((o) => ({ name: o.name, price: toRupees(o.pricePaise), isVeg: o.isVeg })) })) ?? [],
  };
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FoodEditor({ restaurantId, food, defaultCuisine, onClose }: { restaurantId: string; food: FoodDTO | null; defaultCuisine: Cuisine; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => fromFood(food, defaultCuisine));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const save = useSaveFood(restaurantId);
  const config = useConfig();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const input = {
      name: d.name,
      description: d.description,
      section: d.section,
      cuisine: d.cuisine,
      pricePaise: toPaise(d.price) ?? 0,
      compareAtPricePaise: toPaise(d.compareAt),
      imageUrl: d.imageUrl,
      art: d.art,
      isVeg: d.isVeg,
      dietTags: d.dietTags,
      allergens: d.allergens,
      tags: d.tags,
      spiceLevel: d.spiceLevel,
      isAvailable: d.isAvailable,
      isBestseller: d.isBestseller,
      variants: d.variants.map((v) => ({ name: v.name, pricePaise: toPaise(v.price) ?? 0 })),
      addOnGroups: d.addOnGroups.map((g) => ({ ...g, options: g.options.map((o) => ({ name: o.name, pricePaise: toPaise(o.price) ?? 0, isVeg: o.isVeg })) })),
    };
    const parsed = foodInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    save.mutate(
      { ...(parsed.data as FoodInput), id: food?._id },
      {
        onSuccess: () => {
          toast.success(food ? 'Dish updated' : 'Dish added 🍽️');
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.details) setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v[0] ?? ''])));
          else toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={food ? `Edit ${food.name}` : 'Add a dish'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={save.isPending}>Save dish</Button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_200px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name" error={errors.name}>{(p) => <Input {...p} value={d.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description}>{(p) => <Textarea {...p} value={d.description} onChange={(e) => set('description', e.target.value)} />}</Field>
          </div>
          <Field label="Menu section" error={errors.section}>{(p) => <Input {...p} value={d.section} onChange={(e) => set('section', e.target.value)} />}</Field>
          <Field label="Cuisine">
            {(p) => (
              <Select {...p} value={d.cuisine} onChange={(e) => set('cuisine', e.target.value as Cuisine)}>
                {CUISINES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Price (₹)" error={errors.pricePaise}>{(p) => <Input {...p} inputMode="decimal" value={d.price} onChange={(e) => set('price', e.target.value)} />}</Field>
          <Field label="Original price (₹, optional)" hint="Shows a discount when higher than the price">{(p) => <Input {...p} inputMode="decimal" value={d.compareAt} onChange={(e) => set('compareAt', e.target.value)} />}</Field>
        </div>
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-lg">
            <FoodArt art={d.art} imageUrl={d.imageUrl} />
          </div>
          {config.data?.uploads ? (
            <label className="block cursor-pointer rounded-md border-2 border-dashed border-line p-2 text-center text-sm font-semibold hover:border-brand">
              {uploading ? 'Uploading…' : d.imageUrl ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    set('imageUrl', await uploadImage(file, 'food'));
                  } catch (err) {
                    toast.error('Upload failed', errorMessage(err));
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          ) : null}
          {d.imageUrl ? <Button variant="ghost" size="sm" onClick={() => set('imageUrl', null)}>Use illustration</Button> : null}
          <Select aria-label="Illustration" value={d.art.kind} onChange={(e) => set('art', { ...d.art, kind: e.target.value })}>
            {FOOD_ART_KINDS.map((k) => <option key={k}>{k}</option>)}
          </Select>
          <label className="block text-xs font-semibold text-ink-faint">
            Colour
            <input type="range" min={0} max={360} value={d.art.hue} onChange={(e) => set('art', { ...d.art, hue: Number(e.target.value) })} className="mt-1 w-full accent-[var(--color-brand)]" />
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Switch checked={d.isVeg} onChange={(v) => set('isVeg', v)} label="Vegetarian" />
        <Switch checked={d.isAvailable} onChange={(v) => set('isAvailable', v)} label="Available" />
        <Switch checked={d.isBestseller} onChange={(v) => set('isBestseller', v)} label="Bestseller badge" />
        <label className="flex items-center justify-between gap-3 font-semibold">
          Spice level
          <Select className="w-32" value={d.spiceLevel} onChange={(e) => set('spiceLevel', Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : '🌶️'.repeat(n)}</option>)}
          </Select>
        </label>
      </div>

      {[
        { label: 'Flavour & occasion tags (used for moods and recommendations)', values: FOOD_TAGS, key: 'tags' as const },
        { label: 'Diet', values: DIET_TAGS, key: 'dietTags' as const },
        { label: 'Allergens', values: ALLERGENS, key: 'allergens' as const },
      ].map((group) => (
        <fieldset key={group.key} className="mt-6">
          <legend className="mb-2 font-semibold">{group.label}</legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((v) => (
              <Chip key={v} active={d[group.key].includes(v)} onClick={() => set(group.key, toggle(d[group.key], v))}>{v}</Chip>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Sizes (optional)</legend>
        {d.variants.map((v, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Input aria-label="Size name" value={v.name} placeholder="e.g. Regular" onChange={(e) => set('variants', d.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input aria-label="Size price in rupees" value={v.price} placeholder="₹" inputMode="decimal" className="w-32" onChange={(e) => set('variants', d.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove size" onClick={() => set('variants', d.variants.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => set('variants', [...d.variants, { name: '', price: '' }])}>Add size</Button>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Add-on groups (optional)</legend>
        {d.addOnGroups.map((g, gi) => {
          const setGroup = (patch: Partial<Draft['addOnGroups'][number]>) => set('addOnGroups', d.addOnGroups.map((x, j) => (j === gi ? { ...x, ...patch } : x)));
          return (
            <div key={gi} className="mb-3 rounded-md border border-line p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <Input aria-label="Group name" value={g.name} placeholder="e.g. Extras" onChange={(e) => setGroup({ name: e.target.value })} className="flex-1" />
                <Input aria-label="Minimum picks" type="number" min={0} value={g.minSelect} onChange={(e) => setGroup({ minSelect: Number(e.target.value) })} className="w-24" />
                <Input aria-label="Maximum picks" type="number" min={1} value={g.maxSelect} onChange={(e) => setGroup({ maxSelect: Number(e.target.value) })} className="w-24" />
                <Button variant="ghost" size="icon" aria-label="Remove group" onClick={() => set('addOnGroups', d.addOnGroups.filter((_, j) => j !== gi))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {g.options.map((o, oi) => (
                <div key={oi} className="mb-2 flex gap-2 pl-4">
                  <Input aria-label="Option name" value={o.name} placeholder="Option" onChange={(e) => setGroup({ options: g.options.map((x, j) => (j === oi ? { ...x, name: e.target.value } : x)) })} />
                  <Input aria-label="Option price in rupees" value={o.price} placeholder="₹" inputMode="decimal" className="w-28" onChange={(e) => setGroup({ options: g.options.map((x, j) => (j === oi ? { ...x, price: e.target.value } : x)) })} />
                  <Button variant="ghost" size="icon" aria-label="Remove option" onClick={() => setGroup({ options: g.options.filter((_, j) => j !== oi) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setGroup({ options: [...g.options, { name: '', price: '', isVeg: true }] })}>Add option</Button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => set('addOnGroups', [...d.addOnGroups, { name: '', minSelect: 0, maxSelect: 1, options: [{ name: '', price: '', isVeg: true }] }])}>Add group</Button>
      </fieldset>
      {Object.keys(errors).length ? (
        <p role="alert" className="mt-4 rounded-md bg-danger/10 p-3 text-sm font-semibold text-danger">
          {Object.entries(errors).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </p>
      ) : null}
    </Modal>
  );
}
