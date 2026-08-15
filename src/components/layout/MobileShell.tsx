import type { ReactNode } from 'react';
import { Eye, PencilLine } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import EditorPane from '../editor/EditorPane';
import PreviewPane from '../preview/PreviewPane';

/** 移动端单栏（<768px）：Segmented 分段切换编辑/预览 + 底部格式条（UIUX-V2 §4.4） */
export default function MobileShell() {
  const mobileMode = useUiStore((s) => s.mobileMode);
  const setMobileMode = useUiStore((s) => s.setMobileMode);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-bg px-3 py-2">
        <div role="tablist" aria-label="编辑/预览切换" className="flex rounded-md bg-surface-sunken p-0.5">
          <SegButton active={mobileMode === 'edit'} label="编辑" onClick={() => setMobileMode('edit')} icon={<PencilLine size={16} aria-hidden />} />
          <SegButton active={mobileMode === 'preview'} label="预览" onClick={() => setMobileMode('preview')} icon={<Eye size={16} aria-hidden />} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {mobileMode === 'edit' ? <EditorPane /> : <PreviewPane />}
      </div>
    </div>
  );
}

function SegButton({
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
      className={`flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded transition-colors duration-150 ${
        active ? 'bg-accent text-on-accent wt-medium' : 'text-fg-2 hover:text-fg'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
