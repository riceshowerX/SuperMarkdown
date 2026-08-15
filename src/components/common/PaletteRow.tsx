import type { PaletteItem } from './paletteItems';

/** 命令面板结果行（36px，图标 + 标签 + 快捷键 chip；UIUX-V2 §5.2） */
export default function PaletteRow({
  item,
  active,
  onHover,
  onSelect,
}: {
  item: PaletteItem;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      key={item.id}
      id={`sm-palette-item-${item.id}`}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors duration-100 md:min-h-9 md:py-2 ${
        active ? 'bg-accent-soft' : 'bg-transparent'
      }`}
    >
      <item.icon size={16} strokeWidth={1.8} className={`shrink-0 ${active ? 'text-accent' : 'text-fg-2'}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate tx-sm text-fg">{item.label}</span>
      {item.hint && (
        <kbd className="shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
          {item.hint}
        </kbd>
      )}
    </button>
  );
}
