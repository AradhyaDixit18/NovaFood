import { useState } from 'react';
import { Link } from 'react-router';
import { STATUS_META } from '@novafood/shared';
import { BarList, ColumnChart, StatTile } from '../../components/charts/Charts';
import { PageLoader } from '../../components/States';
import { money } from '../../lib/format';
import { Tabs } from '../../ui/controls';
import { Card, Switch } from '../../ui/primitives';
import { type Analytics, usePartnerAnalytics, usePartnerRestaurant, useSelectedRestaurant, useUpdateRestaurant } from './api';

const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function DashboardBody({ analytics, days, hideRating }: { analytics: Analytics & { rating: number; ratingCount: number }; days: number; hideRating?: boolean }) {
  const statuses = Object.entries(analytics.statusCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => ({ label: STATUS_META[s as keyof typeof STATUS_META].label, value: n }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={money(analytics.totals.revenuePaise)} hint={`Last ${days} days, incl. taxes & fees`} />
        <StatTile label="Orders" value={String(analytics.totals.orders)} hint="Placed and not cancelled" />
        <StatTile label="Avg order value" value={money(analytics.totals.averageOrderValuePaise)} />
        {hideRating ? (
          <StatTile label="Delivered" value={String(analytics.statusCounts.DELIVERED)} hint="Completed in this period" />
        ) : (
          <StatTile label="Rating" value={analytics.ratingCount ? `${analytics.rating.toFixed(1)} ★` : 'New'} hint={`${analytics.ratingCount} reviews`} />
        )}
      </div>
      <Card className="p-5">
        <ColumnChart
          title="Daily revenue"
          data={analytics.daily.map((d) => ({ label: shortDay(d.date), value: d.revenuePaise }))}
          format={(v) => money(v)}
          tickLabel={(l, i) => (i % Math.ceil(analytics.daily.length / 6) === 0 ? l : null)}
        />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <BarList title="Top dishes" data={analytics.topFoods.map((f) => ({ label: f.name, value: f.quantity, hint: money(f.revenuePaise) }))} format={(v) => `${v} sold`} />
        </Card>
        <Card className="p-5">
          <BarList title="Orders by status" data={statuses} format={(v) => String(v)} />
        </Card>
      </div>
    </div>
  );
}

export function PartnerDashboard() {
  const id = useSelectedRestaurant((s) => s.id);
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const analytics = usePartnerAnalytics(id, Number(days));
  const restaurant = usePartnerRestaurant(id);
  const update = useUpdateRestaurant(id);

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-64 flex-1">
          <Switch
            checked={restaurant.data?.restaurant.isAcceptingOrders ?? false}
            disabled={!restaurant.data || update.isPending}
            onChange={(v) => update.mutate({ isAcceptingOrders: v })}
            label="Accepting orders"
            description="Pause to stop new orders instantly, e.g. when the kitchen is overloaded."
          />
        </div>
        <Link to="/partner/orders" className="font-semibold text-brand hover:underline">Open live orders →</Link>
      </Card>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Performance</h2>
        <Tabs value={days} onChange={setDays} items={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
      </div>
      {analytics.isLoading || !analytics.data ? <PageLoader /> : <DashboardBody analytics={analytics.data} days={Number(days)} />}
    </div>
  );
}
