import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import type { ToastItem } from '../../types/models';

const kindMeta = {
  success: { icon: CheckCircle2, cls: 'text-success' },
  error: { icon: AlertTriangle, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-info' },
} as const;

/** Toast 容器（z-toast，右下角；error 常驻可重试，其余 5s 自动消失） */
export default function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-toast flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const meta = kindMeta[toast.kind];
  const Icon = meta.icon;
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className="pointer-events-auto flex items-start gap-3 rounded-md bg-surface p-3 shadow-[var(--elev-raised)]"
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${meta.cls}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="tx-sm wt-medium text-fg">{toast.title}</p>
        {toast.message && <p className="mt-0.5 tx-xs text-muted lh-xs">{toast.message}</p>}
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="mt-1.5 inline-flex h-11 items-center rounded px-2 tx-xs wt-medium text-accent hover:bg-accent-soft transition-colors duration-150 md:h-7"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关闭提示"
        className="shrink-0 rounded p-2 text-fg-2 hover:bg-surface-warm md:p-0.5"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
