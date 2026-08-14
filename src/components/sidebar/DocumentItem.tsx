import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FileCode2, FileText, MoreHorizontal, PencilLine, Trash2 } from 'lucide-react';
import type { Document } from '../../types/models';
import { useDocumentsStore } from '../../stores/documents.store';
import { useUiStore } from '../../stores/ui.store';
import { formatRelativeTime } from '../../utils/file';
import { exportDocumentById } from '../../app/actions';
import { toAppError } from '../../utils/errors';

interface Props {
  doc: Document;
  onNavigate?: () => void;
}

/** 列表项：选中 accent-soft 底 + 左侧 3px 竖线；hover 显示操作菜单（PAGES §3） */
export default function DocumentItem({ doc, onNavigate }: Props) {
  const activeDocId = useDocumentsStore((s) => s.activeDocId);
  const searchQuery = useDocumentsStore((s) => s.searchQuery);
  const setActiveDocId = useDocumentsStore((s) => s.setActiveDocId);
  const deleteDocument = useDocumentsStore((s) => s.deleteDocument);
  const renameDocument = useDocumentsStore((s) => s.renameDocument);
  const pushToast = useUiStore((s) => s.pushToast);
  const openConfirm = useUiStore((s) => s.openConfirm);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = activeDocId === doc.id;
  const relativeTime = useMemo(() => formatRelativeTime(doc.updatedAt), [doc.updatedAt]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const commitRename = () => {
    setRenaming(false);
    const name = draft.trim();
    if (!name || name === doc.title) return;
    void renameDocument(doc.id, name).catch((err) => {
      pushToast({ kind: 'error', title: '重命名失败', message: toAppError(err).userMessage });
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    openConfirm({
      title: '删除文档',
      message: `确定删除「${doc.title}」？此操作不可撤销。`,
      confirmLabel: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDocument(doc.id);
          pushToast({ kind: 'success', title: '已删除', message: doc.title });
        } catch (err) {
          pushToast({ kind: 'error', title: '删除失败', message: toAppError(err).userMessage });
        }
      },
    });
  };

  return (
    <div
      className={`group relative flex min-h-11 items-center rounded-md transition-colors duration-150 md:min-h-10 ${
        isActive ? 'bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]' : 'hover:bg-surface-sunken'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          void setActiveDocId(doc.id);
          onNavigate?.();
        }}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md px-2 text-left"
        aria-current={isActive ? 'true' : undefined}
      >
        <FileText size={16} strokeWidth={1.8} className="shrink-0 text-fg-2" aria-hidden />
        <span className="min-w-0 flex-1">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(doc.title);
                  setRenaming(false);
                }
              }}
              aria-label="重命名文档"
              className="w-full rounded border border-accent bg-bg px-1 tx-sm text-fg outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="block truncate tx-sm text-fg">
              <Highlight text={doc.title} query={searchQuery} />
            </span>
          )}
          <span className="block truncate tx-xs text-fg-2">{relativeTime}</span>
        </span>
      </button>

      <div ref={menuRef} className="relative mr-1 shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`${doc.title} 的操作`}
          aria-expanded={menuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-md text-fg-2 opacity-100 transition-colors duration-150 hover:bg-surface-warm group-hover:opacity-100 md:h-8 md:w-8 md:p-0 md:opacity-0"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-dropdown mt-1 w-40 rounded-md bg-surface p-1 shadow-[var(--elev-raised)]">
            <MenuItem
              icon={PencilLine}
              label="重命名"
              onClick={() => {
                setMenuOpen(false);
                setDraft(doc.title);
                setRenaming(true);
              }}
            />
            <MenuItem
              icon={FileCode2}
              label="导出 HTML"
              onClick={() => {
                setMenuOpen(false);
                void exportDocumentById(doc.id, 'html');
              }}
            />
            <MenuItem
              icon={FileText}
              label="导出纯文本"
              onClick={() => {
                setMenuOpen(false);
                void exportDocumentById(doc.id, 'txt');
              }}
            />
            <MenuItem icon={Trash2} label="删除" danger onClick={handleDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof PencilLine;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2 rounded px-2 py-2.5 tx-sm transition-colors duration-150 md:min-h-0 md:py-1.5 ${
        danger ? 'text-danger hover:bg-surface-warm' : 'text-fg hover:bg-surface-warm'
      }`}
    >
      <Icon size={14} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

/** 搜索命中高亮（无 dangerouslySetInnerHTML） */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const parts: ReactNode[] = [
    text.slice(0, idx),
    <mark key="hit" className="rounded-sm bg-accent-soft text-fg">
      {text.slice(idx, idx + q.length)}
    </mark>,
    text.slice(idx + q.length),
  ];
  return <>{parts}</>;
}
