import { Eye, PencilLine } from 'lucide-react';
import { useUiStore } from '../../stores/ui.store';
import EditorPane from '../editor/EditorPane';
import PreviewPane from '../preview/PreviewPane';
import Segmented from '../common/Segmented';

/** 移动端单栏（<768px）：Segmented 分段切换编辑/预览 + 底部格式条（UIUX-V2 §4.4）；MUI-09 复用共享 Segmented（touch） */
export default function MobileShell() {
  const mobileMode = useUiStore((s) => s.mobileMode);
  const setMobileMode = useUiStore((s) => s.setMobileMode);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-bg px-3 py-2">
        <Segmented
          size="touch"
          ariaLabel="编辑/预览切换"
          value={mobileMode}
          onChange={setMobileMode}
          options={[
            { value: 'edit', label: '编辑', icon: <PencilLine size={16} aria-hidden /> },
            { value: 'preview', label: '预览', icon: <Eye size={16} aria-hidden /> },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {mobileMode === 'edit' ? <EditorPane /> : <PreviewPane />}
      </div>
    </div>
  );
}
