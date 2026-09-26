import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../lib/cn';
import { useToasts } from '../stores/toast';

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const tones = { success: 'text-success', error: 'text-danger', info: 'text-grape' };

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-lift"
            >
              <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', tones[t.tone])} />
              <div className="flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-sm text-ink-soft">{t.body}</p> : null}
                {t.action ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-bold text-brand hover:underline"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded-full p-1 text-ink-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
