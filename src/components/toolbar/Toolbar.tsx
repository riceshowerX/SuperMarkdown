import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Columns2,
  Download,
  Eye,
  FileCode2,
  FileText,
  Menu,
  PencilLine,
  type LucideIcon,
} from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { exportCurrentDocument } from '../../app/actions';
import { toAppError } from '../../utils/errors';
import ThemeToggle from '../common/ThemeToggle';
import IconButton from './IconButton';

/** 顶栏 AppBar（PAGES §2）：Logo + 标题重命名 + 导出 + 视图模式 + 主题 */
export default function Toolbar() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const activeDoc = useDocumentsStore((s) => s.documents.find((d) => d.id === s.activeDocId));
  const renameDocument = useDocumentsStore((s) => s.renameDocument);
  const editorContent = useEditorStore((s) => s.content);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const hasContent = editorContent.trim() !== '';
  const isSaving = saveStatus === 'saving' || saveStatus === 'error';

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const commitRename = () => {
    setRenaming(false);
    const name = draft.trim();
    if (!name || !activeDoc || name === activeDoc.title) return;
    void renameDocument(activeDoc.id, name).catch((err) => {
      useUiStore.getState().pushToast({ kind: 'error', title: '重命名失败', message: toAppError(err).userMessage });
    });
  };

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-bg px-3">
      {isMobile && (
        <IconButton icon={Menu} label="打开文档列表" iconSize={20} onClick={() => setMobileSidebarOpen(true)} />
      )}

      <div className="flex shrink-0 items-center gap-2" aria-hidden>
        <FileText size={18} strokeWidth={1.8} className="text-accent" />
        <span className="hidden wt-semibold tx-sm text-fg sm:inline">SuperMarkdown</span>
      </div>

      {/* 文档标题（点击重命名） */}
      {renaming && activeDoc ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(activeDoc.title);
              setRenaming(false);
            }
          }}
          aria-label="重命名文档"
          className="min-w-0 flex-1 rounded border border-accent bg-surface px-2 tx-sm text-fg outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!activeDoc) return;
            setDraft(activeDoc.title);
            setRenaming(true);
          }}
          title="点击重命名"
          className="flex min-h-11 min-w-0 flex-1 items-center truncate self-stretch rounded px-2 text-left tx-sm wt-medium text-fg hover:bg-surface-warm md:min-h-9 md:py-1"
        >
          {activeDoc ? activeDoc.title : '无标题文档'}
        </button>
      )}

      <div className="flex-1" />

      {/* 导出菜单 */}
      {!isMobile && (
        <div ref={exportRef} className="relative">
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => setExportOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 tx-sm text-fg-2 transition-colors duration-150 hover:bg-surface-warm active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download size={18} strokeWidth={1.8} aria-hidden />
            导出
            <ChevronDown size={14} aria-hidden />
          </button>
          {exportOpen && (
            <div role="menu" aria-label="导出" className="absolute right-0 top-full z-dropdown mt-1 w-44 rounded-md bg-surface p-1 shadow-[var(--elev-raised)]">
              <ExportItem icon={FileCode2} label="导出 HTML" onClick={() => { setExportOpen(false); void exportCurrentDocument('html'); }} />
              <ExportItem icon={FileText} label="导出纯文本" onClick={() => { setExportOpen(false); void exportCurrentDocument('txt'); }} />
            </div>
          )}
        </div>
      )}

      {/* 视图模式（桌面循环：分屏/编辑/预览） */}
      {!isMobile && <ViewModeCycle />}

      <ThemeToggle />

      {/* 保存状态徽标（移动端状态栏并入顶栏） */}
      {isMobile && isSaving && (
        <span className={`tx-xs ${saveStatus === 'error' ? 'text-danger' : 'text-warn'}`}>
          {saveStatus === 'error' ? '保存失败' : '保存中'}
        </span>
      )}
    </header>
  );
}

function ExportItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 tx-sm text-fg hover:bg-surface-warm"
    >
      <Icon size={14} strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}

function ViewModeCycle() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const next = viewMode === 'split' ? 'edit' : viewMode === 'edit' ? 'preview' : 'split';
  const icon = viewMode === 'split' ? Columns2 : viewMode === 'edit' ? PencilLine : Eye;
  const label = `视图模式：${viewMode === 'split' ? '分屏' : viewMode === 'edit' ? '仅编辑' : '仅预览'}`;
  return <IconButton icon={icon} label={`${label}（点击切换）`} iconSize={20} onClick={() => setViewMode(next)} />;
}
