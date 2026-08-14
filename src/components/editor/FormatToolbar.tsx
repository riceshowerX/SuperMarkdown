import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table,
  type LucideIcon,
} from 'lucide-react';
import type { EditorCommand } from '../../utils/editor';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
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
}

interface ToolItem {
  cmd: EditorCommand;
  icon: LucideIcon;
  label: string;
}

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
    { cmd: 'h3', icon: Heading3, label: '三级标题' },
  ],
  [
    { cmd: 'quote', icon: Quote, label: '引用' },
    { cmd: 'codeBlock', icon: Code2, label: '代码块' },
  ],
  [
    { cmd: 'ul', icon: List, label: '无序列表' },
    { cmd: 'ol', icon: ListOrdered, label: '有序列表' },
    { cmd: 'task', icon: ListChecks, label: '任务列表' },
  ],
  [
    { cmd: 'table', icon: Table, label: '插入表格' },
    { cmd: 'hr', icon: Minus, label: '分隔线' },
  ],
];

const COMPACT_CMDS: EditorCommand[] = ['bold', 'italic', 'h1', 'h2', 'quote', 'codeBlock'];

/**
 * 格式工具栏：桌面悬浮胶囊（floating）/ 移动端底部条（compact）
 * 图片按钮走文件选择 → ClipboardService → 光标处插入（P1 功能并入 MVP）
 */
export default function FormatToolbar({ floating = false, compact = false, onCommand, onInsertImage }: FormatToolbarProps) {
  const hasDoc = useEditorStore((s) => s.docId !== null);

  const groups = compact
    ? GROUPS.map((g) => g.filter((item) => COMPACT_CMDS.includes(item.cmd))).filter((g) => g.length > 0)
    : GROUPS;

  return (
    <div
      className={`${
        floating
          ? 'absolute left-1/2 top-2 z-sticky -translate-x-1/2'
          : 'flex h-[52px] shrink-0 items-center justify-center gap-1 border-t border-border bg-surface px-2'
      }`}
      role="toolbar"
      aria-label="格式工具栏"
    >
      <div
        className={`flex items-center gap-1 ${
          floating ? 'rounded-lg bg-surface px-1.5 py-1 shadow-[var(--elev-raised)]' : ''
        }`}
      >
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <div className="mx-1 h-4 w-px bg-border-soft" aria-hidden />}
            {group.map((item) => (
              <button
                key={item.cmd}
                type="button"
                aria-label={item.label}
                title={item.label}
                disabled={!hasDoc}
                onClick={() => onCommand(item.cmd)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-warm active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none md:h-8 md:w-8"
              >
                <item.icon size={16} strokeWidth={1.8} aria-hidden />
              </button>
            ))}
          </div>
        ))}
        <div className="mx-1 h-4 w-px bg-border-soft" aria-hidden />
        <ImageButton disabled={!hasDoc} onInsertImage={onInsertImage} />
      </div>
    </div>
  );
}

function ImageButton({ disabled, onInsertImage }: { disabled: boolean; onInsertImage: (text: string) => void }) {
  const pushToast = useUiStore((s) => s.pushToast);
  return (
    <>
      <button
        type="button"
        aria-label="插入图片"
        title="插入图片"
        disabled={disabled}
        onClick={() => document.getElementById('sm-image-input')?.click()}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-warm active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none md:h-8 md:w-8"
      >
        <ImagePlus size={16} strokeWidth={1.8} aria-hidden />
      </button>
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
            pushToast({ kind: warning ? 'info' : 'success', title: '图片已插入', message: warning ?? undefined });
          } catch (err) {
            if (err instanceof ImageTooLargeError) {
              pushToast({ kind: 'error', title: '图片过大', message: err.userMessage });
            } else {
              const appErr = toAppError(err);
              pushToast({ kind: 'error', title: '图片读取失败', message: appErr.userMessage });
            }
          }
        }}
      />
    </>
  );
}
