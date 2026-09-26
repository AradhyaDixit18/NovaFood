import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Renders as a bottom sheet on small screens. */
  sheet?: boolean;
}

/**
 * Built on the native <dialog> element, which gives focus trapping, Escape to close,
 * inert background content and correct screen-reader semantics for free.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', sheet = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto max-h-[92dvh] w-full overflow-hidden rounded-xl bg-surface p-0 text-ink shadow-lift open:flex open:flex-col',
        size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
        sheet && 'max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none',
      )}
    >
      {open ? (
        <>
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
            <div>
              <h2 id="modal-title" className="text-xl font-bold">
                {title}
              </h2>
              {description ? (
                <p id="modal-description" className="mt-1 text-sm text-ink-soft">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 text-ink-soft hover:bg-surface-2 hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <footer className="border-t border-line bg-surface px-6 py-4">{footer}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
}
