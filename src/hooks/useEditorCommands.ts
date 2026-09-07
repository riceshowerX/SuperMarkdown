import { useCallback, useRef } from 'react';
import { useEditorStore } from '../stores/editor.store';
import { applyEditorCommand, insertText, type EditorCommand } from '../utils/editor';

/** 编辑器命令执行：读取光标选区 → 计算新内容 → 写入 store → 恢复焦点/选区 */

/** 把变更以「最小区间替换」写回 textarea（SM-29）：
 *  setRangeText 保留浏览器原生 undo 栈，Ctrl+Z 可逐级撤销格式命令；
 *  通过计算公共前缀/后缀定位被替换区间，避免全量覆盖 value 丢失历史。 */
function writeWithUndoableRange(ta: HTMLTextAreaElement, oldValue: string, newValue: string): void {
  let start = 0;
  const minLen = Math.min(oldValue.length, newValue.length);
  while (start < minLen && oldValue.charCodeAt(start) === newValue.charCodeAt(start)) start++;

  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (oldEnd > start && newEnd > start && oldValue.charCodeAt(oldEnd - 1) === newValue.charCodeAt(newEnd - 1)) {
    oldEnd--;
    newEnd--;
  }

  if (typeof ta.setRangeText === 'function') {
    ta.setRangeText(newValue.slice(start, newEnd), start, oldEnd, 'end');
  } else {
    ta.value = newValue; // 极老内核兜底（无 setRangeText）
  }
}

export function useEditorCommands() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setContent = useEditorStore((s) => s.setContent);

  /** 统一写入路径：textarea 变更（可撤销）→ store 同步 → 恢复焦点/选区（SM-77：选区钳制防越界） */
  const applyEdit = useCallback(
    (oldValue: string, newValue: string, start: number, end: number) => {
      const ta = textareaRef.current;
      if (!ta) return;
      writeWithUndoableRange(ta, oldValue, newValue);
      setContent(ta.value);
      // SM-77：选区钳制到新文本长度内，避免越界导致光标设置失败/选区丢失
      const clamp = (pos: number) => Math.max(0, Math.min(pos, ta.value.length));
      const nextStart = clamp(start);
      const nextEnd = clamp(end);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(nextStart, nextEnd);
      });
    },
    [setContent],
  );

  const applyCommand = useCallback(
    (cmd: EditorCommand) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const result = applyEditorCommand(ta.value, ta.selectionStart, ta.selectionEnd, cmd);
      applyEdit(ta.value, result.value, result.start, result.end);
    },
    [applyEdit],
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const result = insertText(ta.value, ta.selectionStart, ta.selectionEnd, text);
      applyEdit(ta.value, result.value, result.start, result.end);
    },
    [applyEdit],
  );

  return { textareaRef, applyCommand, insertAtCursor };
}
