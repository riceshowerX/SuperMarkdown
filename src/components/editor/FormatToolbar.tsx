import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Keyboard,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Quote,
  Table,
  type LucideIcon,
} from 'lucide-react';
import type { EditorCommand } from '../../utils/editor';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
import { getCommandShortcut } from '../../config/shortcuts';
import {
  extractImage,
  buildMarkdownImage,
  getImageWarnMessage,
  ImageTooLargeError,
} from '../../services/clipboard/clipboard.service';
import { toAppError } from '../../utils/errors';

interface FormatToolbarProps {
  floating?: boolean;
  compact?: boolean;
  onCommand: (cmd: EditorCommand) => void;
  onInsertImage: (text: string) => void;
  /** 打开快捷键面板（溢出菜单入口，批次 3 接入） */
  onOpenShortcuts?: () => void;
}

interface ToolItem {
  cmd: EditorCommand;
  icon: LucideIcon;
  label: string;
}

/** G1 行内 / G2 块级 / G3 结构（UIUX-V2 §4.2 枚举锁定，可见 ≤11 + 溢出） */
const GROUPS: ToolItem[][] = [
  [
    { cmd: 'bold', icon: Bold, label: '加粗' },
    { cmd: 'italic', icon: Italic, label: '斜体' },
    { cmd: 'inlineCode', icon: Code, label: '行内代码' },
    { cmd: 'link', icon: Link, label: '链接' },
  ],
  [
    { cmd: 'h1', icon: Heading1, label: '一级标题' },
    { cmd: 'h2', icon: Heading2, label: '二级标题' },
    { cmd: 'quote', icon: Quote, label: '引用' },
    { cmd: 'codeBlock', icon: Code2, label: '代码块' },
  ],
  [
    { cmd: 'ul', icon: List, label: '无序列表' },
    { cmd: 'ol', icon: ListOrdered, label: '有序列表' },
    { cmd: 'task', icon: ListChecks, label: '任务列表' },
  ],
];

/** G4 溢出：结构/插入类低频操作 */
const OVERFLOW_ITEMS: ToolItem[] = [
  { cmd: 'table', icon: Table, label: '插入表格' },
  { cmd: 'hr', icon: Minus, label: '分隔线' },
];

/** 全部按钮扁平表（桌面溢出 / 移动端溢出共用的图标与文案来源） */
const FLAT_ITEMS: ToolItem[] = [...GROUPS.flat(), ...OVERFLOW_ITEMS];

/** 移动端高频 6 个（UIUX-V2 §4.2） */
const COMPACT_CMDS: EditorCommand[] = ['bold', 'italic', 'h1', 'h2', 'quote', 'codeBlock'];

/**
 * 格式工具栏：桌面悬浮胶囊（floating）/ 移动端底部条（compact）
 * 分组收敛 ≤11 可见 + 溢出菜单；按钮 title 含快捷键（被动学习）；图片走文件选择 → 光标处插入
 */
export default function FormatToolbar({ floating = false, compact = false, onCommand, onInsertImage, onOpenShortcuts }: FormatToolbarProps) {
  const hasDoc = useEditorStore((s) => s.docId !== null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const visibleGroups = compact ? [GROUPS.flat().filter((i) => COMPACT_CMDS.includes(i.cmd))] : GROUPS;
  const overflowItems = compact
    ? FLAT_ITEMS.filter((i) => !COMPACT_CMDS.includes(i.cmd))
    : OVERFLOW_ITEMS;

  return (
    <div
      className={`${
        floating
          ? 'flex shrink-0 items-center justify-center gap-1 border-b border-border bg-surface px-2 py-1.5'
          : 'flex h-[52px] shrink-0 items-center justify-center gap-1 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)]'
      }`}
      role="toolbar"
      aria-label="格式工具栏"
    >
      <div
        className={`flex items-center ${
          floating
            ? 'gap-0.5'
            : 'gap-0.5'
        }`}
      >
        {visibleGroups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <div className="mx-1 h-4 w-px bg-border-soft" aria-hidden />}
            {group.map((item) => (
              <ToolButton
                key={item.cmd}
                item={item}
                compact={compact}
                disabled={!hasDoc}
                onClick={() => onCommand(item.cmd)}
              />
            ))}
          </div>
        ))}

        {/* 溢出菜单 */}
        <div ref={moreRef} className="relative">
          <div className="mx-1 h-4 w-px bg-border-soft" aria-hidden />
          <button
            type="button"
            aria-label="更多格式"
            aria-expanded={moreOpen}
            title="更多格式"
            disabled={!hasDoc}
            onClick={() => setMoreOpen((v) => !v)}
            className={`inline-flex items-center justify-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-sunken active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none ${
              compact ? 'h-11 w-11' : 'h-[30px] w-[30px]'
            }`}
          >
            <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden />
          </button>
          {moreOpen && (
            <div
              role="menu"
              aria-label="更多格式"
              className={`absolute z-dropdown min-w-44 rounded-[var(--radius-lg)] bg-surface-raised p-1 shadow-[var(--elev-popover)] ${
                compact ? 'bottom-full right-0 mb-1' : 'right-0 top-full mt-1'
              }`}
            >
              {overflowItems.map((item) => (
                <button
                  key={item.cmd}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    onCommand(item.cmd);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2.5 tx-sm text-fg transition-colors duration-150 hover:bg-surface-sunken md:min-h-0 md:py-1.5"
                >
                  <item.icon size={14} strokeWidth={1.8} aria-hidden />
                  {item.label}
                </button>
              ))}
              <OverflowImageItem disabled={!hasDoc} onClose={() => setMoreOpen(false)} />
              {onOpenShortcuts && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenShortcuts();
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2.5 tx-sm text-fg transition-colors duration-150 hover:bg-surface-sunken md:min-h-0 md:py-1.5"
                >
                  <Keyboard size={14} strokeWidth={1.8} aria-hidden />
                  快捷键
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* 隐藏文件输入：溢出菜单「插入图片」触发 */}
      <input
        id="sm-image-input"
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const dataUrl = await extractImage(file);
            onInsertImage(buildMarkdownImage(dataUrl));
            const warning = getImageWarnMessage(file.size);
            useUiStore.getState().pushToast({ kind: warning ? 'info' : 'success', title: '图片已插入', message: warning ?? undefined });
          } catch (err) {
            if (err instanceof ImageTooLargeError) {
              useUiStore.getState().pushToast({ kind: 'error', title: '图片过大', message: err.userMessage });
            } else {
              const appErr = toAppError(err);
              useUiStore.getState().pushToast({ kind: 'error', title: '图片读取失败', message: appErr.userMessage });
            }
          }
        }}
      />
    </div>
  );
}

function ToolButton({
  item,
  compact,
  disabled,
  onClick,
}: {
  item: ToolItem;
  compact?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const shortcut = getCommandShortcut(item.cmd);
  return (
    <button
      type="button"
      aria-label={item.label}
      title={shortcut ? `${item.label} ${shortcut.display}` : item.label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-sunken active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none ${
        compact ? 'h-11 w-11' : 'h-[30px] w-[30px]'
      }`}
    >
      <item.icon size={16} strokeWidth={1.8} aria-hidden />
    </button>
  );
}

function OverflowImageItem({ disabled, onClose }: { disabled: boolean; onClose: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClose();
        document.getElementById('sm-image-input')?.click();
      }}
      className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2.5 tx-sm text-fg transition-colors duration-150 hover:bg-surface-sunken disabled:opacity-40 md:min-h-0 md:py-1.5"
    >
      <ImagePlus size={14} strokeWidth={1.8} aria-hidden />
      插入图片
    </button>
  );
}
