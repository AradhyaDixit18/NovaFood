import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { ClipboardList, LayoutDashboard, Settings, UtensilsCrossed } from 'lucide-react';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';
import { cn } from '../../lib/cn';
import { ButtonLink } from '../../ui/Button';
import { Badge, Select } from '../../ui/primitives';
import { useMyRestaurants, useSelectedRestaurant } from './api';

export function PortalNav({ items }: { items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] }) {
  return (
    <nav aria-label="Portal" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex shrink-0 items-center gap-3 rounded-md px-4 py-2.5 text-sm font-semibold', isActive ? 'bg-ink text-canvas' : 'text-ink-soft hover:bg-surface-2 hover:text-ink')}>
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function PartnerLayout() {
  const { data, isLoading } = useMyRestaurants();
  const { id, set } = useSelectedRestaurant();

  useEffect(() => {
    if (data?.length && (!id || !data.some((r) => r._id === id))) set(data[0]!._id);
  }, [data, id, set]);

  if (isLoading) return <PageLoader />;
  if (!data?.length) {
    return <EmptyState title="No restaurant yet" body="Apply to list your kitchen on NovaFood." action={<ButtonLink to="/partner/apply">Apply now</ButtonLink>} />;
  }
  const current = data.find((r) => r._id === id) ?? data[0]!;

  return (
    <div className="container-nf py-8">
      <Seo title="Partner portal" noindex />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand">Partner portal</p>
          <h1 className="text-3xl font-extrabold">{current.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {current.status !== 'APPROVED' ? <Badge tone="warning">{current.status === 'PENDING' ? 'Awaiting approval' : 'Suspended'}</Badge> : current.isOpen ? <Badge tone="success">Open</Badge> : <Badge>Closed</Badge>}
          {data.length > 1 ? (
            <Select aria-label="Choose restaurant" value={current._id} onChange={(e) => set(e.target.value)} className="w-56">
              {data.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>
      {current.status === 'PENDING' ? (
        <p className="mb-6 rounded-lg bg-warning/12 p-4 text-sm font-semibold text-warning">
          Your restaurant is waiting for NovaFood approval. You can set up the menu now; customers will see it once approved.
        </p>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <PortalNav
            items={[
              { to: '/partner', label: 'Dashboard', icon: LayoutDashboard, end: true },
              { to: '/partner/orders', label: 'Live orders', icon: ClipboardList },
              { to: '/partner/menu', label: 'Menu', icon: UtensilsCrossed },
              { to: '/partner/settings', label: 'Settings', icon: Settings },
            ]}
          />
        </aside>
        <section>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
