import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { FoodDTO } from '@novafood/shared';
import { FoodArt } from '../../components/food/FoodArt';
import { EmptyState, PageLoader } from '../../components/States';
import { errorMessage } from '../../lib/api';
import { money } from '../../lib/format';
import { confirm } from '../../stores/confirm';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Card, Switch, VegMark } from '../../ui/primitives';
import { useDeleteFood, usePartnerRestaurant, useSaveFood, useSelectedRestaurant } from './api';
import { FoodEditor } from './FoodEditor';

export function PartnerMenu() {
  const id = useSelectedRestaurant((s) => s.id);
  const { data, isLoading } = usePartnerRestaurant(id);
  const save = useSaveFood(id);
  const remove = useDeleteFood();
  const [editing, setEditing] = useState<FoodDTO | 'new' | null>(null);

  const sections = useMemo(() => {
    const map = new Map<string, FoodDTO[]>();
    for (const f of data?.foods ?? []) map.set(f.section, [...(map.get(f.section) ?? []), f]);
    return [...map.entries()];
  }, [data]);

  if (isLoading || !data) return <PageLoader />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Menu ({data.foods.length} dishes)</h2>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add dish</Button>
      </div>
      {sections.length === 0 ? (
        <EmptyState title="Kitchen abhi silent hai 👀" body="Add your first dish to go live." />
      ) : (
        sections.map(([section, foods]) => (
          <section key={section} className="mb-8">
            <h3 className="mb-3 font-display text-lg font-bold">{section}</h3>
            <Card className="divide-y divide-line">
              {foods.map((f) => (
                <div key={f._id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="h-14 w-14 overflow-hidden rounded-md"><FoodArt art={f.art} imageUrl={f.imageUrl} width={112} rounded="rounded-md" /></span>
                  <div className="min-w-40 flex-1">
                    <p className="flex items-center gap-2 font-semibold"><VegMark veg={f.isVeg} /> {f.name}</p>
                    <p className="text-sm text-ink-faint">{money(f.pricePaise)} · {f.orderCount} sold{f.ratingCount ? ` · ${f.rating.toFixed(1)}★` : ''}</p>
                  </div>
                  <div className="w-36">
                    <Switch
                      checked={f.isAvailable}
                      label={f.isAvailable ? 'In stock' : 'Sold out'}
                      onChange={(v) => save.mutate({ id: f._id, isAvailable: v }, { onError: (err) => toast.error(errorMessage(err)) })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${f.name}`}
                    className="text-danger"
                    onClick={async () => {
                      if (await confirm({ title: `Delete ${f.name}?`, body: 'It disappears from the menu. Past orders keep their history.', confirmLabel: 'Delete', danger: true })) {
                        remove.mutate(f._id, { onError: (err) => toast.error(errorMessage(err)) });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Card>
          </section>
        ))
      )}
      {editing ? <FoodEditor restaurantId={data.restaurant._id} food={editing === 'new' ? null : editing} defaultCuisine={data.restaurant.cuisines[0] ?? 'North Indian'} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
