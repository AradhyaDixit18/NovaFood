import { useEffect, useMemo, useState } from 'react';
import { computeUnitPrice } from '@novafood/shared';
import { useAddToCart } from '../../api/cart';
import { type Target, useCustomizer } from './useDishAdder';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { Button } from '../../ui/Button';
import { QuantityStepper } from '../../ui/controls';
import { Modal } from '../../ui/Modal';
import { Textarea, VegMark } from '../../ui/primitives';
import { FoodArt } from './FoodArt';

export function DishCustomizerHost() {
  const target = useCustomizer((s) => s.target);
  const close = useCustomizer((s) => s.close);
  return target ? <Customizer key={target.food._id} target={target} onClose={close} /> : null;
}

function Customizer({ target, onClose }: { target: Target; onClose: () => void }) {
  const { food, restaurant } = target;
  const add = useAddToCart();
  const [variantId, setVariantId] = useState<string | null>(food.variants[0]?._id ?? null);
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(food.addOnGroups.map((g) => [g._id, g.minSelect > 0 ? g.options.slice(0, g.minSelect).map((o) => o._id) : []])),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [food._id]);

  const addOnIds = Object.values(picked).flat();
  const unit = useMemo(() => {
    const variant = food.variants.find((v) => v._id === variantId);
    const options = food.addOnGroups.flatMap((g) => g.options).filter((o) => addOnIds.includes(o._id));
    return computeUnitPrice(food.pricePaise, variant?.pricePaise ?? null, options.map((o) => o.pricePaise));
  }, [food, variantId, addOnIds]);

  const groupErrors = food.addOnGroups.filter((g) => (picked[g._id]?.length ?? 0) < g.minSelect).map((g) => g.name);

  const toggle = (groupId: string, optionId: string, max: number) =>
    setPicked((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (current.length >= max) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });

  const dismiss = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={food.name}
      description={food.description}
      footer={
        <div className="flex items-center justify-between gap-4">
          <QuantityStepper value={quantity} min={1} onChange={setQuantity} label={food.name} />
          <Button
            size="lg"
            className="flex-1"
            loading={add.isPending}
            disabled={groupErrors.length > 0}
            onClick={() =>
              add.mutate(
                { food, restaurant, variantId, addOnIds, quantity, note: note.trim() || undefined, origin: target.origin },
                { onSuccess: dismiss },
              )
            }
          >
            Add item · {money(unit * quantity)}
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <div className="h-20 w-20 shrink-0">
          <FoodArt art={food.art} imageUrl={food.imageUrl} width={160} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <VegMark veg={food.isVeg} />
          {food.nutrition ? <span>{food.nutrition.calories} kcal</span> : null}
          {food.allergens.length ? <span>Contains {food.allergens.join(', ')}</span> : null}
        </div>
      </div>

      {food.variants.length > 0 ? (
        <fieldset className="mb-6">
          <legend className="mb-2 font-display text-lg font-bold">Choose a size</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {food.variants.map((v) => (
              <label key={v._id} className={cn('flex cursor-pointer items-center justify-between rounded-md border-2 px-4 py-3 transition-colors', variantId === v._id ? 'border-brand bg-brand-soft/40 dark:bg-brand/10' : 'border-line hover:border-ink-faint')}>
                <span className="flex items-center gap-3 font-semibold">
                  <input type="radio" name="variant" className="accent-[var(--color-brand)]" checked={variantId === v._id} onChange={() => setVariantId(v._id)} />
                  {v.name}
                </span>
                <span className="text-sm font-bold">{money(v.pricePaise)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {food.addOnGroups.map((g) => (
        <fieldset key={g._id} className="mb-6">
          <legend className="mb-1 font-display text-lg font-bold">{g.name}</legend>
          <p className="mb-2 text-sm text-ink-faint">
            {g.minSelect > 0 ? `Pick ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}` : `Optional · up to ${g.maxSelect}`}
          </p>
          <div className="space-y-2">
            {g.options.map((o) => {
              const checked = picked[g._id]?.includes(o._id) ?? false;
              const full = !checked && g.maxSelect > 1 && (picked[g._id]?.length ?? 0) >= g.maxSelect;
              return (
                <label key={o._id} className={cn('flex cursor-pointer items-center justify-between rounded-md border-2 px-4 py-3', checked ? 'border-brand' : 'border-line', full && 'opacity-50')}>
                  <span className="flex items-center gap-3">
                    <input
                      type={g.maxSelect === 1 ? 'radio' : 'checkbox'}
                      name={g._id}
                      className="accent-[var(--color-brand)]"
                      checked={checked}
                      disabled={full}
                      onChange={() => toggle(g._id, o._id, g.maxSelect)}
                    />
                    <VegMark veg={o.isVeg} />
                    {o.name}
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">+{money(o.pricePaise)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <label className="block">
        <span className="mb-2 block font-display text-lg font-bold">Cooking instructions</span>
        <Textarea value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Less spicy please, no onions…" />
      </label>
    </Modal>
  );
}
