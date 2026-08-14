import { useCallback, useRef } from 'react';
import { useEditorStore } from '../stores/editor.store';
import { applyEditorCommand, insertText, type EditorCommand } from '../utils/editor';

/** 编辑器命令执行：读取光标选区 → 计算新内容 → 写入 store → 恢复焦点/选区 */
export function useEditorCommands() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setContent = useEditorStore((s) => s.setContent);

  const applyCommand = useCallback(
    (cmd: EditorCommand) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const result = applyEditorCommand(ta.value, ta.selectionStart, ta.selectionEnd, cmd);
      setContent(result.value);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(result.start, result.end);
      });
    },
    [setContent],
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const result = insertText(ta.value, ta.selectionStart, ta.selectionEnd, text);
      setContent(result.value);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(result.start, result.end);
      });
    },
    [setContent],
  );

  return { textareaRef, applyCommand, insertAtCursor };
}
