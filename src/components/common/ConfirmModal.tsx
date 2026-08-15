import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, CloudUpload, TriangleAlert } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';

/** 确认对话框（z-modal；危险操作主按钮语义红；Esc/遮罩关闭；focus trap；UIUX-V2 §6） */
export default function ConfirmModal() {
  const confirm = useUiStore((s) => s.confirm);
  const closeConfirm = useUiStore((s) => s.closeConfirm);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeConfirm();
        return;
      }
      // 简易 focus trap：Tab 在对话框内循环
      if (e.key === 'Tab') {
        const el = dialogRef.current;
        if (!el) return;
        const focusables = Array.from(
          el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter((n) => !n.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    cancelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, closeConfirm]);

  if (!confirm) return null;
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeConfirm();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sm-confirm-title"
        className="overlay-enter w-full max-w-sm rounded-[var(--radius-lg)] bg-surface-raised p-5 shadow-[var(--elev-popover)]"
      >
        <div className="mb-2 flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${confirm.danger ? 'bg-danger/10' : 'bg-accent/10'}`}>
            <TriangleAlert size={16} className={confirm.danger ? 'text-danger' : 'text-accent'} aria-hidden />
          </span>
          <h2 id="sm-confirm-title" className="tx-base wt-semibold text-fg">
            {confirm.title}
          </h2>
        </div>
        <p className="mb-5 tx-sm text-muted lh-body">{confirm.message}</p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={closeConfirm}
            className="inline-flex h-11 items-center rounded-md px-3 tx-sm wt-medium text-fg transition-colors duration-150 hover:bg-surface-warm md:h-9"
          >
            {confirm.cancelLabel ?? '取消'}
          </button>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                try {
                  await confirm.onConfirm();
                  closeConfirm();
                } catch {
                  closeConfirm();
                }
              })();
            }}
            className={`inline-flex h-11 items-center rounded-md px-4 tx-sm wt-medium text-white transition-colors duration-150 md:h-9 ${
              confirm.danger ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirm.confirmLabel ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 保存状态指示器（状态栏三态） */
export function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-warn" aria-live="polite">
        <CloudUpload size={12} className="save-pulse" aria-hidden /> 保存中
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-success" aria-live="polite">
        <CheckCircle2 size={12} aria-hidden /> 已保存
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-danger" role="alert">
      <AlertCircle size={12} aria-hidden /> 保存失败
    </span>
  );
}
