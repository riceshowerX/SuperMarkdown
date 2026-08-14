import { useEditorCommands } from '../../hooks/useEditorCommands';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import FormatToolbar from './FormatToolbar';
import TextareaEditor from './TextareaEditor';

/** 编辑器区（PAGES §4）：桌面悬浮格式条 + textarea；移动端底部格式条 */
export default function EditorPane() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { textareaRef, applyCommand, insertAtCursor } = useEditorCommands();

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-surface-sunken" aria-label="编辑器">
      {!isMobile && <FormatToolbar floating onCommand={applyCommand} onInsertImage={insertAtCursor} />}
      <TextareaEditor textareaRef={textareaRef} insertAtCursor={insertAtCursor} />
      {isMobile && <FormatToolbar compact onCommand={applyCommand} onInsertImage={insertAtCursor} />}
    </section>
  );
}
