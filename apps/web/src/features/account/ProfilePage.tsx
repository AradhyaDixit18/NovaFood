import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Download, MailWarning, MapPin, Pencil, Trash2 } from 'lucide-react';
import { type AddressDTO, CUISINES, DIET_TAGS } from '@novafood/shared';
import { useDeleteAddress, useUpdateProfile } from '../../api/account';
import { useChangePassword, useResendVerification } from '../../api/auth';
import { useConfig } from '../../api/catalog';
import { Seo } from '../../components/Seo';
import { api, errorMessage } from '../../lib/api';
import { shortDate } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { confirm } from '../../stores/confirm';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Tabs } from '../../ui/controls';
import { Card, Chip, Field, Input, Switch } from '../../ui/primitives';
import { AddressModal } from './AddressForm';

type Tab = 'account' | 'addresses' | 'preferences' | 'notifications' | 'privacy';

function AccountTab() {
  const user = useAuth((s) => s.user)!;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const update = useUpdateProfile();
  const resend = useResendVerification();
  const config = useConfig();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const image = await api<{ url: string }>('/uploads/image', { method: 'POST', body: form, query: { purpose: 'avatar' } });
      await update.mutateAsync({ avatarUrl: image.url });
      toast.success('Looking good 😎');
    } catch (err) {
      toast.error('Upload failed', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!user.emailVerified ? (
        <Card className="flex flex-col gap-3 border-warning/40 p-5 sm:flex-row sm:items-center">
          <MailWarning className="h-6 w-6 text-warning" />
          <p className="flex-1 text-sm">
            <span className="font-semibold">Verify your email</span> to get order receipts and recover your account.
          </p>
          <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate(undefined, { onSuccess: () => toast.success('Verification email sent 📬'), onError: (e) => toast.error(errorMessage(e)) })}>
            Resend link
          </Button>
        </Card>
      ) : null}
      <Card className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-grape font-display text-3xl font-bold text-white">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.name[0]?.toUpperCase()}
            </span>
            {config.data?.uploads ? (
              <>
                <button type="button" aria-label="Change profile picture" onClick={() => fileInput.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-brand text-white">
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </>
            ) : null}
          </div>
          <div>
            <p className="font-display text-xl font-bold">{user.name}</p>
            <p className="text-sm text-ink-faint">{user.email} · member since {shortDate(user.createdAt)}</p>
          </div>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ name, phone: phone || null }, { onSuccess: () => toast.success('Profile updated ✅'), onError: (err) => toast.error(errorMessage(err)) });
          }}
        >
          <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}</Field>
          <Field label="Phone">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />}</Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={update.isPending}>Save changes</Button>
          </div>
        </form>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-bold">Change password</h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            changePassword.mutate(
              { currentPassword: current, newPassword: next },
              {
                onSuccess: () => {
                  toast.success('Password changed', 'Please log in again on all your devices.');
                  navigate('/login');
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <Field label="Current password">{(p) => <Input {...p} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
          <Field label="New password" hint="8+ characters with a letter and a number">{(p) => <Input {...p} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}</Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" loading={changePassword.isPending} disabled={!current || next.length < 8}>Update password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AddressesTab() {
  const user = useAuth((s) => s.user)!;
  const [editing, setEditing] = useState<AddressDTO | null | 'new'>(null);
  const remove = useDeleteAddress();
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {user.addresses.map((a) => (
          <Card key={a._id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand" /> {a.label} {a.isDefault ? <span className="text-xs text-ink-faint">Default</span> : null}</p>
                <p className="mt-1 text-sm text-ink-soft">{[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
              </div>
              <div className="flex">
                <button type="button" aria-label={`Edit ${a.label} address`} onClick={() => setEditing(a)} className="rounded-full p-2 hover:bg-surface-2"><Pencil className="h-4 w-4" /></button>
                <button
                  type="button"
                  aria-label={`Delete ${a.label} address`}
                  onClick={async () => (await confirm({ title: 'Delete this address?', confirmLabel: 'Delete', danger: true })) && remove.mutate(a._id)}
                  className="rounded-full p-2 text-danger hover:bg-surface-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        <button type="button" onClick={() => setEditing('new')} className="rounded-lg border-2 border-dashed border-line p-6 font-semibold text-ink-soft hover:border-brand hover:text-brand">
          + Add address
        </button>
      </div>
      {editing ? <AddressModal key={editing === 'new' ? 'new' : editing._id} open onClose={() => setEditing(null)} address={editing === 'new' ? null : editing} /> : null}
    </div>
  );
}

function PreferencesTab() {
  const user = useAuth((s) => s.user)!;
  const update = useUpdateProfile();
  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Card className="space-y-6 p-6">
      <Switch checked={user.vegetarianOnly} onChange={(v) => update.mutate({ vegetarianOnly: v })} label="Vegetarian only" description="Recommendations will only show veg dishes" />
      <div>
        <p className="mb-2 font-semibold">Dietary preferences</p>
        <div className="flex flex-wrap gap-2">
          {DIET_TAGS.map((t) => (
            <Chip key={t} active={user.dietaryPreferences.includes(t)} onClick={() => update.mutate({ dietaryPreferences: toggleIn(user.dietaryPreferences, t) })}>
              {t}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold">Favourite cuisines</p>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip key={c} active={user.favoriteCuisines.includes(c)} onClick={() => update.mutate({ favoriteCuisines: toggleIn(user.favoriteCuisines, c) })}>
              {c}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

function NotificationsTab() {
  const user = useAuth((s) => s.user)!;
  const update = useUpdateProfile();
  const prefs = user.notificationPrefs;
  return (
    <Card className="space-y-5 p-6">
      <Switch checked={prefs.orderUpdates} onChange={(v) => update.mutate({ notificationPrefs: { orderUpdates: v } })} label="Order updates" description="Kitchen and delivery progress. Payment and refund notices are always sent." />
      <Switch checked={prefs.offers} onChange={(v) => update.mutate({ notificationPrefs: { offers: v } })} label="Offers & coupons" />
      <Switch checked={prefs.recommendations} onChange={(v) => update.mutate({ notificationPrefs: { recommendations: v } })} label="Restaurant news" />
      <Switch checked={prefs.email} onChange={(v) => update.mutate({ notificationPrefs: { email: v } })} label="Email receipts" />
    </Card>
  );
}

function PrivacyTab() {
  const user = useAuth((s) => s.user)!;
  const update = useUpdateProfile();
  const download = async () => {
    try {
      const data = await api<unknown>('/users/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'novafood-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card className="space-y-5 p-6">
      <Switch checked={user.privacy.personalizedRecommendations} onChange={(v) => update.mutate({ privacy: { personalizedRecommendations: v } })} label="Personalised recommendations" description="Use my order history and favourites to pick dishes for me" />
      <Switch checked={user.privacy.showNameOnShareCards} onChange={(v) => update.mutate({ privacy: { showNameOnShareCards: v } })} label="Show my first name on share cards" />
      <div className="border-t border-line pt-5">
        <p className="font-semibold">Your data</p>
        <p className="mb-3 text-sm text-ink-soft">Download everything NovaFood stores about you: profile, orders, reviews and favourites.</p>
        <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={download}>Download my data</Button>
      </div>
    </Card>
  );
}

export function ProfilePage() {
  const [tab, setTab] = useState<Tab>('account');
  return (
    <div className="container-nf py-8">
      <Seo title="Your profile" noindex />
      <h1 className="mb-6 text-4xl font-extrabold">Profile</h1>
      <div className="scrollbar-none -mx-4 mb-6 overflow-x-auto px-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'account', label: 'Account' },
            { value: 'addresses', label: 'Addresses' },
            { value: 'preferences', label: 'Food preferences' },
            { value: 'notifications', label: 'Notifications' },
            { value: 'privacy', label: 'Privacy' },
          ]}
        />
      </div>
      <div className="max-w-3xl">
        {tab === 'account' ? <AccountTab /> : tab === 'addresses' ? <AddressesTab /> : tab === 'preferences' ? <PreferencesTab /> : tab === 'notifications' ? <NotificationsTab /> : <PrivacyTab />}
      </div>
    </div>
  );
}
