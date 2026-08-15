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
  Search,
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
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

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
    <header className="flex h-[var(--layout-appbar-h)] shrink-0 items-center gap-2 border-b border-border bg-bg px-3">
      {isMobile && (
        <IconButton icon={Menu} label="打开文档列表" iconSize={20} onClick={() => setMobileSidebarOpen(true)} />
      )}

      {/* 品牌（C 版弱化：小图标无强调色；PAGES §2） */}
      <FileText size={16} strokeWidth={1.8} className="shrink-0 text-fg-2" aria-hidden />

      {/* 面包屑：工作区 / 文档名（点击重命名；PAGES §2 chrome 退化） */}
      {renaming && activeDoc ? (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 self-stretch py-1">
          <span className="tx-sm text-fg-2">工作区</span>
          <span className="text-border" aria-hidden>/</span>
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
            className="min-w-0 max-w-[40vw] rounded border border-accent bg-surface px-1.5 tx-sm text-fg outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!activeDoc) return;
            setDraft(activeDoc.title);
            setRenaming(true);
          }}
          title="点击重命名"
          className="flex min-h-11 min-w-0 shrink-0 items-center gap-1.5 self-stretch rounded px-1.5 text-left hover:bg-surface-warm md:min-h-9"
        >
          <span className="tx-sm text-fg-2">工作区</span>
          <span className="text-border" aria-hidden>/</span>
          <span className="truncate tx-sm wt-medium text-fg">
            {activeDoc ? activeDoc.title : '无标题文档'}
          </span>
        </button>
      )}

      <div className="flex-1" />

      {/* 命令面板入口（Cmd+K；移动端只留图标，文案隐藏） */}
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="打开命令面板"
        title="命令面板 ⌘K"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2.5 text-fg-2 transition-colors duration-150 hover:bg-block-hover active:bg-accent-soft md:w-56 md:justify-between"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Search size={16} strokeWidth={1.8} aria-hidden />
          <span className="hidden truncate tx-sm md:inline">搜索或输入命令…</span>
        </span>
        <kbd className="hidden rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-fg-2 md:inline">
          ⌘K
        </kbd>
      </button>

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

      {/* 视图模式（桌面 Segmented 3 态：分屏/编辑/预览） */}
      {!isMobile && <ViewModeSegmented />}

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

function ViewModeSegmented() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const modes = [
    { mode: 'split' as const, icon: Columns2, label: '分屏' },
    { mode: 'edit' as const, icon: PencilLine, label: '编辑' },
    { mode: 'preview' as const, icon: Eye, label: '预览' },
  ];
  return (
    <div role="group" aria-label="视图模式" className="flex items-center rounded-md bg-surface-sunken p-0.5">
      {modes.map(({ mode, icon: Icon, label }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={`视图：${label}`}
            title={`视图：${label}`}
            onClick={() => setViewMode(mode)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors duration-150 ${
              active ? 'bg-surface-raised text-accent shadow-[var(--elev-ring)]' : 'text-fg-2 hover:text-fg'
            }`}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
