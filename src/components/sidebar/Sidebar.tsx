import { FilePlus2, PanelLeftOpen } from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';
import { useUiStore } from '../../stores/ui.store';
import SearchBox from './SearchBox';
import DocumentList from './DocumentList';
import IconButton from '../toolbar/IconButton';

/** 侧边栏（桌面常驻 / 移动抽屉复用，onNavigate 用于抽屉关闭） */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const docCount = useDocumentsStore((s) => s.documents.length);
  const isDrawer = typeof onNavigate === 'function';

  if (collapsed && !isDrawer) {
    return (
      <aside className="flex w-[var(--layout-sidebar-w-collapsed)] shrink-0 flex-col items-center gap-2 border-r border-border bg-bg py-3">
        <IconButton
          icon={FilePlus2}
          label="新建文档"
          onClick={() => void createDocument()}
          className="text-accent"
          iconSize={20}
        />
        <IconButton icon={PanelLeftOpen} label="展开侧边栏" onClick={toggleSidebar} iconSize={20} />
      </aside>
    );
  }

  return (
    <aside className="flex w-[var(--layout-sidebar-w)] shrink-0 flex-col overflow-hidden border-r border-border bg-bg">
      <div className="space-y-2 p-3">
        <SearchBox />
        <button
          type="button"
          onClick={() => void createDocument()}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-transparent tx-sm wt-medium text-accent transition-colors duration-150 hover:bg-surface-warm active:bg-accent-soft md:h-9"
        >
          <FilePlus2 size={18} strokeWidth={1.8} aria-hidden />
          新建文档
        </button>
      </div>
      <DocumentList onNavigate={onNavigate} />
      <div className="flex items-center justify-between border-t border-border-soft px-3 py-2">
        <span className="tx-xs text-fg-2">{docCount} 篇文档</span>
        {!isDrawer && (
          <IconButton icon={PanelLeftOpen} label="折叠侧边栏" onClick={toggleSidebar} iconSize={16} />
        )}
      </div>
    </aside>
  );
}
