import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { type AddressDTO, type AddressInput, addressSchema } from '@novafood/shared';
import { useSaveAddress } from '../../api/account';
import { ApiError, errorMessage } from '../../lib/api';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Checkbox, Field, Input } from '../../ui/primitives';

/** Optional inputs submit '' when left empty; the schema expects the key to be absent. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export function AddressModal({ open, onClose, address, onSaved }: { open: boolean; onClose: () => void; address?: AddressDTO | null; onSaved?: (a: AddressDTO) => void }) {
  const save = useSaveAddress();
  const form = useForm<z.input<typeof addressSchema>, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? { label: address.label, line1: address.line1, line2: address.line2, landmark: address.landmark, city: address.city, state: address.state, pincode: address.pincode, phone: address.phone, isDefault: address.isDefault }
      : { label: 'Home', city: 'Bengaluru', state: 'Karnataka', isDefault: false },
  });
  const { register, handleSubmit, formState, setValue, watch, setError } = form;
  const e = formState.errors;

  const submit = handleSubmit((values) =>
    save.mutate(
      { ...values, id: address?._id, phone: values.phone || undefined, line2: values.line2 || undefined, landmark: values.landmark || undefined },
      {
        onSuccess: (saved) => {
          toast.success('Address saved 📍');
          onSaved?.(saved);
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.details) {
            for (const [field, messages] of Object.entries(err.details)) setError(field as keyof AddressInput, { message: messages[0] });
          } else toast.error(errorMessage(err));
        },
      },
    ),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={address ? 'Edit address' : 'Add a delivery address'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={save.isPending}>Save address</Button>
        </div>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2 flex gap-2" role="radiogroup" aria-label="Address label">
          {['Home', 'Work', 'Other'].map((l) => (
            <button key={l} type="button" role="radio" aria-checked={watch('label') === l} onClick={() => setValue('label', l)} className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${watch('label') === l ? 'border-ink bg-ink text-canvas' : 'border-line'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Field label="House / flat, building and street" error={e.line1?.message}>{(p) => <Input {...p} {...register('line1')} autoComplete="address-line1" />}</Field>
        </div>
        <Field label="Area (optional)" error={e.line2?.message}>{(p) => <Input {...p} {...register('line2', { setValueAs: blankToUndefined })} autoComplete="address-line2" />}</Field>
        <Field label="Landmark (optional)" error={e.landmark?.message}>{(p) => <Input {...p} {...register('landmark', { setValueAs: blankToUndefined })} />}</Field>
        <Field label="City" error={e.city?.message}>{(p) => <Input {...p} {...register('city')} autoComplete="address-level2" />}</Field>
        <Field label="State" error={e.state?.message}>{(p) => <Input {...p} {...register('state')} autoComplete="address-level1" />}</Field>
        <Field label="PIN code" error={e.pincode?.message}>{(p) => <Input {...p} {...register('pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" />}</Field>
        <Field label="Phone for this address (optional)" error={e.phone?.message}>{(p) => <Input {...p} {...register('phone', { setValueAs: blankToUndefined })} inputMode="tel" autoComplete="tel" />}</Field>
        <div className="sm:col-span-2">
          <Checkbox checked={Boolean(watch('isDefault'))} onChange={(v) => setValue('isDefault', v)} label="Make this my default address" />
        </div>
      </form>
    </Modal>
  );
}
