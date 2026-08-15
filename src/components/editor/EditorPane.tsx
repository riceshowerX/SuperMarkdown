import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useEditorCommands } from '../../hooks/useEditorCommands';
import { registerEditorActions, unregisterEditorActions } from '../../hooks/editorCommandBus';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
import FormatToolbar from './FormatToolbar';
import TextareaEditor from './TextareaEditor';

/** 编辑器区：textarea + 保存失败内联条；桌面格式操作走 Cmd+K 命令面板（最大化编辑区高度）；移动端保留底部格式条 */
export default function EditorPane() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { textareaRef, applyCommand, insertAtCursor } = useEditorCommands();
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const retrySave = useEditorStore((s) => s.retrySave);

  // 注册命令总线：命令面板/全局快捷键可触发格式命令
  useEffect(() => {
    registerEditorActions(applyCommand, insertAtCursor);
    return () => unregisterEditorActions();
  }, [applyCommand, insertAtCursor]);

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-surface" aria-label="编辑器">
      {saveStatus === 'error' && <SaveErrorBar onRetry={() => void retrySave()} />}
      <TextareaEditor textareaRef={textareaRef} insertAtCursor={insertAtCursor} />
      {isMobile && (
        <FormatToolbar compact onCommand={applyCommand} onInsertImage={insertAtCursor} onOpenShortcuts={() => useUiStore.getState().setShortcutsOpen(true)} />
      )}
    </section>
  );
}

/** 保存失败内联错误条（UIUX-V2 §5.5：不打断输入，常驻可重试） */
function SaveErrorBar({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="relative z-[2] flex shrink-0 items-center gap-2 border-b border-danger/20 bg-danger/5 px-4 py-1.5"
    >
      <AlertCircle size={14} className="shrink-0 text-danger" aria-hidden />
      <span className="min-w-0 flex-1 truncate tx-xs text-danger">保存失败，内容仍保留在本地，可重试或导出备份</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded px-2 tx-xs wt-medium text-danger transition-colors duration-150 hover:bg-danger/10"
      >
        <RotateCcw size={12} aria-hidden />
        重试
      </button>
    </div>
  );
}
