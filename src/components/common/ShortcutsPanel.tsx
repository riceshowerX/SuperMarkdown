import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import { SHORTCUTS, type ShortcutGroup } from '../../config/shortcuts';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const GROUP_ORDER: ShortcutGroup[] = ['文档', '编辑', '视图', '帮助'];

/** 快捷键面板（?，UIUX-V2 §5.2）：全量快捷键表，分组展示 */
export default function ShortcutsPanel() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="快捷键面板"
        className={`overlay-enter flex w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-lg)] bg-surface-raised shadow-[var(--elev-popover)] ${
          isMobile ? 'max-h-[85dvh]' : 'max-h-[70dvh]'
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Keyboard size={16} className="text-fg-2" aria-hidden />
          <h2 className="tx-base wt-semibold text-fg">快捷键</h2>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭快捷键面板"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-warm"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="sm-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {GROUP_ORDER.map((group) => (
            <section key={group} aria-label={group} className="mb-4">
              <p className="trk-caps mb-1 tx-xs wt-medium text-fg-2">{group}</p>
              <div className="space-y-0.5">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <p className="tx-sm text-fg">{s.label}</p>
                      <p className="tx-xs text-fg-2">{s.description}</p>
                    </div>
                    <kbd className="shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
                      {s.display}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
