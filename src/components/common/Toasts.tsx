import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { TOAST_DURATION_MS } from '../../config/constants';
import type { ToastItem } from '../../types/models';

const kindMeta = {
  success: { icon: CheckCircle2, cls: 'text-success', bg: 'bg-success/10' },
  error: { icon: AlertTriangle, cls: 'text-danger', bg: 'bg-danger/10' },
  info: { icon: Info, cls: 'text-info', bg: 'bg-info/10' },
} as const;

/** Toast 容器（z-toast；桌面右下角，移动端顶部；error 常驻，其余 5s 自动消失且 hover 暂停） */
export default function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div
      className={`pointer-events-none fixed z-toast flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 ${
        // MUI-07：移动端下移避开「编辑/预览」分段头；去掉 overflow-y-auto/max-h（与 pointer-events-none 矛盾且不可滚动，条数上限由 pushToast slice(-4) 保证）
        isMobile ? 'left-1/2 top-28 -translate-x-1/2' : 'bottom-10 right-4'
      }`}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const meta = kindMeta[toast.kind];
  const Icon = meta.icon;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    if (toast.kind === 'error') return; // error 常驻
    timerRef.current = setTimeout(onDismiss, TOAST_DURATION_MS);
  };

  useEffect(() => {
    startTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className="toast-enter pointer-events-auto flex items-start gap-3 rounded-[12px] bg-surface-raised p-3 shadow-[var(--elev-popover)]"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.bg}`}>
        <Icon size={16} className={meta.cls} aria-hidden />
      </span>
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
            className="mt-1.5 inline-flex h-11 items-center rounded px-2 tx-xs wt-medium text-accent transition-colors duration-150 hover:bg-accent-soft md:h-7"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="关闭提示"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-fg-2 transition-colors duration-150 hover:bg-surface-warm md:h-7 md:w-7 md:p-0"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
