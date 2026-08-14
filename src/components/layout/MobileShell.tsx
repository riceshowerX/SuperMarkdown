import type { ReactNode } from 'react';
import { Eye, PencilLine } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import EditorPane from '../editor/EditorPane';
import PreviewPane from '../preview/PreviewPane';

/** 移动端单栏（<768px）：编辑/预览 Tab 切换 + 底部格式条（PAGES §7） */
export default function MobileShell() {
  const mobileMode = useUiStore((s) => s.mobileMode);
  const setMobileMode = useUiStore((s) => s.setMobileMode);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div role="tablist" aria-label="编辑/预览切换" className="flex h-11 shrink-0 border-b border-border bg-bg">
        <TabButton active={mobileMode === 'edit'} label="编辑" onClick={() => setMobileMode('edit')} icon={<PencilLine size={16} aria-hidden />} />
        <TabButton active={mobileMode === 'preview'} label="预览" onClick={() => setMobileMode('preview')} icon={<Eye size={16} aria-hidden />} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {mobileMode === 'edit' ? <EditorPane /> : <PreviewPane />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 tx-sm wt-medium transition-colors duration-150 ${
        active ? 'text-accent' : 'text-fg-2'
      }`}
    >
      {icon}
      {label}
      {active && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />}
    </button>
  );
}
