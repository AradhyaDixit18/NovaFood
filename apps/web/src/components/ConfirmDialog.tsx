import { useConfirmStore } from '../stores/confirm';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const answer = useConfirmStore((s) => s.answer);
  return (
    <Modal
      open={Boolean(request)}
      onClose={() => answer(false)}
      title={request?.title ?? ''}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => answer(false)}>
            {request?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={request?.danger ? 'danger' : 'primary'} onClick={() => answer(true)} autoFocus>
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    >
      <p className="text-ink-soft">{request?.body}</p>
    </Modal>
  );
}
