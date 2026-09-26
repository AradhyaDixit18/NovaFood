import { useState } from 'react';
import { Outlet } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardList, Search, Star, Store, Ticket, Users } from 'lucide-react';
import {
  type CouponDTO,
  type CouponInput,
  ORDER_STATUSES,
  type OrderDTO,
  type OrderStatus,
  ROLES,
  type RestaurantDTO,
  type ReviewDTO,
  STATUS_META,
  type UserDTO,
  couponInputSchema,
  nextStatuses,
} from '@novafood/shared';
import { BarList } from '../../components/charts/Charts';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';
import { api, apiPaged, errorMessage } from '../../lib/api';
import { dateTime, money, shortDate } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { confirm } from '../../stores/confirm';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Pagination, Tabs } from '../../ui/controls';
import { Modal } from '../../ui/Modal';
import { Badge, Card, Checkbox, Field, Input, Select, StarInput } from '../../ui/primitives';
import { StatusBadge } from '../orders/OrderStatus';
import { type Analytics, useUpdateOrderStatus } from '../partner/api';
import { DashboardBody } from '../partner/PartnerDashboard';
import { PortalNav } from '../partner/PartnerLayout';

/* --------------------------------- Layout --------------------------------- */

export function AdminLayout() {
  return (
    <div className="container-nf py-8">
      <Seo title="Admin" noindex />
      <p className="text-sm font-bold uppercase tracking-wider text-brand">NovaFood admin</p>
      <h1 className="mb-6 text-3xl font-extrabold">Control room</h1>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <PortalNav
            items={[
              { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
              { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
              { to: '/admin/restaurants', label: 'Restaurants', icon: Store },
              { to: '/admin/users', label: 'Users', icon: Users },
              { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
              { to: '/admin/reviews', label: 'Reviews', icon: Star },
            ]}
          />
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      if (success) toast.success(success);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 pl-10" />
    </label>
  );
}

const th = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-faint';
const td = 'px-4 py-3 align-top';

/* -------------------------------- Overview -------------------------------- */

export function AdminOverview() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api<Analytics & { counts: { users: number; newUsers: number; restaurants: number; pendingRestaurants: number } }>('/admin/analytics', { query: { days } }),
  });
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge tone="grape">{data.counts.users} users ({data.counts.newUsers} new)</Badge>
          <Badge tone="success">{data.counts.restaurants} live restaurants</Badge>
          {data.counts.pendingRestaurants ? <Badge tone="warning">{data.counts.pendingRestaurants} awaiting approval</Badge> : null}
        </div>
        <Tabs value={days} onChange={setDays} items={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
      </div>
      <DashboardBody analytics={{ ...data, rating: 0, ratingCount: 0 }} days={Number(days)} hideRating />
      <Card className="p-5">
        <BarList title="Top restaurants by revenue" data={data.topRestaurants.map((r) => ({ label: r.name, value: r.revenuePaise, hint: `${r.orders} orders` }))} format={money} />
      </Card>
    </div>
  );
}

/* ---------------------------------- Users --------------------------------- */

export function AdminUsers() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const me = useAuth((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: () => apiPaged<UserDTO[]>('/admin/users', { query: { q, page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });
  const update = useAdminMutation((v: { id: string; status?: string; role?: string }) => api(`/admin/users/${v.id}`, { method: 'PATCH', body: { status: v.status, role: v.role } }), 'User updated');
  return (
    <div>
      <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name or email" />
      {isLoading ? <PageLoader /> : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>User</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Joined</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data?.data.map((u) => (
                <tr key={u._id}>
                  <td className={td}><p className="font-semibold">{u.name}</p><p className="text-xs text-ink-faint">{u.email}</p></td>
                  <td className={td}>
                    <Select aria-label={`Role for ${u.name}`} value={u.role} disabled={u._id === me?._id} onChange={(e) => update.mutate({ id: u._id, role: e.target.value })} className="h-9 w-32 text-sm">
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </Select>
                  </td>
                  <td className={td}>
                    <Button
                      size="sm"
                      variant={u.status === 'ACTIVE' ? 'outline' : 'primary'}
                      disabled={u._id === me?._id}
                      onClick={async () => {
                        const suspend = u.status === 'ACTIVE';
                        if (!suspend || (await confirm({ title: `Suspend ${u.name}?`, body: 'They are signed out everywhere immediately.', confirmLabel: 'Suspend', danger: true }))) {
                          update.mutate({ id: u._id, status: suspend ? 'SUSPENDED' : 'ACTIVE' });
                        }
                      }}
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </td>
                  <td className={`${td} text-ink-faint`}>{shortDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data ? <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /> : null}
    </div>
  );
}

/* ------------------------------- Restaurants ------------------------------ */

export function AdminRestaurants() {
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'SUSPENDED'>('ALL');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'restaurants', status],
    queryFn: () => apiPaged<RestaurantDTO[]>('/admin/restaurants', { query: { status: status === 'ALL' ? undefined : status, limit: 50 } }),
  });
  const update = useAdminMutation((v: { id: string; body: Record<string, unknown> }) => api(`/admin/restaurants/${v.id}`, { method: 'PATCH', body: v.body }), 'Restaurant updated');
  return (
    <div>
      <Tabs value={status} onChange={setStatus} items={[{ value: 'ALL', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Live' }, { value: 'SUSPENDED', label: 'Suspended' }]} />
      {isLoading ? <PageLoader /> : !data?.data.length ? <EmptyState compact title="Nothing here" /> : (
        <div className="mt-4 grid gap-3">
          {data.data.map((r) => (
            <Card key={r._id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-48 flex-1">
                <p className="font-display font-bold">{r.name}</p>
                <p className="text-sm text-ink-faint">{r.cuisines.join(', ')} · {r.area} · {r.ratingCount ? `${r.rating.toFixed(1)}★ (${r.ratingCount})` : 'no reviews'}</p>
              </div>
              <Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'danger'}>{r.status}</Badge>
              {r.status !== 'APPROVED' ? <Button size="sm" onClick={() => update.mutate({ id: r._id, body: { status: 'APPROVED' } })}>Approve</Button> : null}
              {r.status !== 'SUSPENDED' ? (
                <Button size="sm" variant="outline" onClick={async () => (await confirm({ title: `Suspend ${r.name}?`, body: 'It disappears from NovaFood until reactivated.', confirmLabel: 'Suspend', danger: true })) && update.mutate({ id: r._id, body: { status: 'SUSPENDED' } })}>
                  Suspend
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Orders -------------------------------- */

export function AdminOrders() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OrderDTO | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', q, status, page],
    queryFn: () => apiPaged<OrderDTO[]>('/admin/orders', { query: { q, status: status || undefined, page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });
  const move = useUpdateOrderStatus('admin');
  const refund = useAdminMutation((v: { id: string; settledManually: boolean }) => api(`/admin/orders/${v.id}/refund`, { method: 'POST', body: { settledManually: v.settledManually } }), 'Refund updated');

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Order number, customer or restaurant" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }} className="w-56">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
      </div>
      {isLoading ? <PageLoader /> : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Order</th><th className={th}>Customer</th><th className={th}>Total</th><th className={th}>Status</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-line">
              {data?.data.map((o) => (
                <tr key={o._id}>
                  <td className={td}><p className="font-semibold">{o.orderNumber}</p><p className="text-xs text-ink-faint">{o.restaurant.name} · {dateTime(o.createdAt)}</p></td>
                  <td className={td}>{o.customer?.name}</td>
                  <td className={td}>{money(o.pricing.totalPaise)}<p className="text-xs text-ink-faint">{o.payment.method} · {o.payment.status}</p></td>
                  <td className={td}><StatusBadge status={o.status} /></td>
                  <td className={td}><Button size="sm" variant="ghost" onClick={() => setSelected(o)}>Manage</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data ? <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /> : null}
      {selected ? (
        <Modal open onClose={() => setSelected(null)} title={`Order ${selected.orderNumber}`} description={`${selected.restaurant.name} · ${selected.customer?.name ?? ''}`}>
          <p className="mb-2 text-sm">Current status: <StatusBadge status={selected.status} /></p>
          <ul className="mb-4 text-sm text-ink-soft">{selected.lines.map((l, i) => <li key={i}>{l.quantity}× {l.name}</li>)}</ul>
          <p className="mb-2 font-semibold">Move to</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses(selected.status, 'admin').map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === 'CANCELLED' || s === 'REJECTED' ? 'danger' : 'primary'}
                loading={move.isPending}
                onClick={() =>
                  move.mutate(
                    { id: selected._id, status: s, reason: s === 'CANCELLED' ? 'Cancelled by NovaFood support' : undefined },
                    { onSuccess: () => { toast.success(`Moved to ${STATUS_META[s].label}`); setSelected(null); }, onError: (err) => toast.error(errorMessage(err)) },
                  )
                }
              >
                {STATUS_META[s].label}
              </Button>
            ))}
            {nextStatuses(selected.status, 'admin').length === 0 ? <p className="text-sm text-ink-faint">No further transitions are allowed.</p> : null}
          </div>
          {selected.status === 'REFUND_PENDING' ? (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={() => refund.mutate({ id: selected._id, settledManually: false }, { onSuccess: () => setSelected(null) })}>Retry gateway refund</Button>
              <Button size="sm" variant="outline" onClick={() => refund.mutate({ id: selected._id, settledManually: true }, { onSuccess: () => setSelected(null) })}>Mark settled manually</Button>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

/* --------------------------------- Coupons -------------------------------- */

type AdminCoupon = CouponDTO & { isActive: boolean; usedCount: number; usageLimit: number | null; perUserLimit: number | null };

function CouponForm({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [value, setValue] = useState('20');
  const [minOrder, setMinOrder] = useState('199');
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUser, setPerUser] = useState('1');
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useAdminMutation((input: CouponInput) => api('/admin/coupons', { method: 'POST', body: input }), 'Coupon created 🎟️');

  const submit = () => {
    const parsed = couponInputSchema.safeParse({
      code,
      description: description || undefined,
      type,
      value: type === 'PERCENT' ? Number(value) : Math.round(Number(value) * 100),
      minOrderPaise: Math.round(Number(minOrder || 0) * 100),
      maxDiscountPaise: maxDiscount && type === 'PERCENT' ? Math.round(Number(maxDiscount) * 100) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      perUserLimit: perUser ? Number(perUser) : null,
      firstOrderOnly,
    });
    if (!parsed.success) return setError(parsed.error.issues.map((i) => i.message).join(' · '));
    setError(null);
    create.mutate(parsed.data, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title="Create coupon" footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={create.isPending}>Create</Button></div>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code">{(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEEKEND40" />}</Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as 'PERCENT' | 'FLAT')}>
              <option value="PERCENT">Percent off</option>
              <option value="FLAT">Flat ₹ off</option>
            </Select>
          )}
        </Field>
        <Field label={type === 'PERCENT' ? 'Percent' : 'Amount (₹)'}>{(p) => <Input {...p} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
        <Field label="Minimum order (₹)">{(p) => <Input {...p} inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />}</Field>
        {type === 'PERCENT' ? <Field label="Max discount (₹)">{(p) => <Input {...p} inputMode="decimal" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />}</Field> : null}
        <Field label="Expires (optional)">{(p) => <Input {...p} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}</Field>
        <Field label="Total uses (optional)">{(p) => <Input {...p} inputMode="numeric" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />}</Field>
        <Field label="Uses per customer (optional)">{(p) => <Input {...p} inputMode="numeric" value={perUser} onChange={(e) => setPerUser(e.target.value)} />}</Field>
        <div className="sm:col-span-2"><Field label="Description (optional)">{(p) => <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field></div>
        <Checkbox checked={firstOrderOnly} onChange={setFirstOrderOnly} label="First order only" />
      </div>
      {error ? <p role="alert" className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
    </Modal>
  );
}

export function AdminCoupons() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api<AdminCoupon[]>('/admin/coupons') });
  const toggle = useAdminMutation((v: { id: string; isActive: boolean }) => api(`/admin/coupons/${v.id}`, { method: 'PATCH', body: { isActive: v.isActive } }));
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button onClick={() => setCreating(true)}>New coupon</Button></div>
      {isLoading ? <PageLoader /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Code</th><th className={th}>Offer</th><th className={th}>Used</th><th className={th}>Expires</th><th className={th}>Active</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data?.map((c) => (
                <tr key={c._id}>
                  <td className={`${td} font-display font-bold`}>{c.code}</td>
                  <td className={td}>{c.description}</td>
                  <td className={td}>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td className={td}>{c.expiresAt ? shortDate(c.expiresAt) : 'Never'}</td>
                  <td className={td}>
                    <Button size="sm" variant={c.isActive ? 'outline' : 'primary'} onClick={() => toggle.mutate({ id: c._id, isActive: !c.isActive })}>{c.isActive ? 'Disable' : 'Enable'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {creating ? <CouponForm onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

/* --------------------------------- Reviews -------------------------------- */

export function AdminReviews() {
  const [filter, setFilter] = useState<'low' | 'hidden' | 'all'>('low');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', filter, page],
    queryFn: () => apiPaged<ReviewDTO[]>('/admin/reviews', { query: { page, limit: 20, maxRating: filter === 'low' ? 2 : undefined, status: filter === 'hidden' ? 'HIDDEN' : undefined } }),
    placeholderData: keepPreviousData,
  });
  const moderate = useAdminMutation((v: { id: string; status: 'PUBLISHED' | 'HIDDEN' }) => api(`/admin/reviews/${v.id}`, { method: 'PATCH', body: { status: v.status } }), 'Review updated');
  return (
    <div>
      <Tabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }} items={[{ value: 'low', label: '1–2 stars' }, { value: 'hidden', label: 'Hidden' }, { value: 'all', label: 'All' }]} />
      {isLoading ? <PageLoader /> : !data?.data.length ? <EmptyState compact title="Nothing to moderate 🎉" /> : (
        <div className="mt-4 space-y-3">
          {data.data.map((r) => (
            <Card key={r._id} className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-48 flex-1">
                <div className="flex items-center gap-2"><StarInput size="sm" value={r.rating} onChange={() => undefined} label="Rating" /> <span className="text-sm text-ink-faint">{r.user.name} · {shortDate(r.createdAt)}{r.foodName ? ` · ${r.foodName}` : ''}</span></div>
                <p className="mt-1 text-sm">{r.comment ?? <span className="text-ink-faint">No comment</span>}</p>
              </div>
              <Badge tone={r.status === 'PUBLISHED' ? 'success' : 'neutral'}>{r.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r._id, status: r.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED' })}>
                {r.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
              </Button>
            </Card>
          ))}
        </div>
      )}
      {data ? <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /> : null}
    </div>
  );
}
