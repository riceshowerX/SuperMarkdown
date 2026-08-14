import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUiStore } from '../../stores/ui.store';
import { useDocumentsStore } from '../../stores/documents.store';
import Toolbar from '../toolbar/Toolbar';
import Sidebar from '../sidebar/Sidebar';
import StatusBar from '../common/StatusBar';
import MobileShell from './MobileShell';
import SplitPane from './SplitPane';
import EditorPane from '../editor/EditorPane';
import PreviewPane from '../preview/PreviewPane';

/** 应用外壳（PAGES §1）：桌面三栏 / 移动单栏抽屉 */
export default function AppShell() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const mobileSidebarOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const viewMode = useUiStore((s) => s.viewMode);
  const splitRatio = useUiStore((s) => s.splitRatio);
  const setSplitRatio = useUiStore((s) => s.setSplitRatio);
  const initError = useDocumentsStore((s) => s.initError);
  const initialize = useDocumentsStore((s) => s.initialize);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileSidebarOpen) setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg font-body">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {isMobile ? (
          <>
            <MobileShell />
            {mobileSidebarOpen && (
              <div className="fixed inset-0 z-modal scrim" onMouseDown={() => setMobileSidebarOpen(false)}>
                <div
                  className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px] shadow-[var(--elev-raised)]"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
                </div>
              </div>
            )}
          </>
        ) : initError ? (
          <InitError onRetry={() => void initialize()} message={initError} />
        ) : (
          <>
            <Sidebar />
            {viewMode === 'edit' && <EditorPane />}
            {viewMode === 'preview' && <PreviewPane />}
            {viewMode === 'split' && (
              <SplitPane
                ratio={splitRatio}
                onRatio={setSplitRatio}
                left={<EditorPane />}
                right={<PreviewPane />}
              />
            )}
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
}

/** 加载失败错误态（重试） */
function InitError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
        <p className="tx-sm wt-medium text-danger">加载失败</p>
        <p className="mt-1 tx-xs text-muted">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 tx-sm wt-medium text-on-accent hover:bg-accent-hover"
        >
          <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
          重试
        </button>
      </div>
    </div>
  );
}
