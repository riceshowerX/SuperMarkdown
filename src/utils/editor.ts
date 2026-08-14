/** 编辑器光标操作纯函数（架构 components/editor 依赖，无 DOM 依赖可测试） */

export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'inlineCode'
  | 'link'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'codeBlock'
  | 'ul'
  | 'ol'
  | 'task'
  | 'table'
  | 'hr';

export interface EditResult {
  value: string;
  start: number;
  end: number;
}

const TABLE_TEMPLATE = [
  '| 列 1 | 列 2 | 列 3 |',
  '| --- | --- | --- |',
  '| 单元格 | 单元格 | 单元格 |',
].join('\n');

/** 在光标处插入文本 */
export function insertText(value: string, selStart: number, selEnd: number, text: string): EditResult {
  const newValue = value.slice(0, selStart) + text + value.slice(selEnd);
  const cursor = selStart + text.length;
  return { value: newValue, start: cursor, end: cursor };
}

/** 包裹选区 */
function wrapSelection(
  value: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  const selected = value.slice(selStart, selEnd);
  const text = selected || placeholder;
  const newValue = value.slice(0, selStart) + before + text + after + value.slice(selEnd);
  return { value: newValue, start: selStart + before.length, end: selStart + before.length + text.length };
}

/** 行前缀（有则移除，无则添加——可切换） */
function toggleLinePrefix(value: string, selStart: number, selEnd: number, prefix: string): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const lineEndIdx = value.indexOf('\n', selEnd);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lineText = value.slice(lineStart, lineEnd);
  const hasPrefix = lineText.startsWith(prefix);
  const newLine = hasPrefix ? lineText.slice(prefix.length) : prefix + lineText;
  const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
  return { value: newValue, start: lineStart, end: lineStart + newLine.length };
}

/** 在行首插入块级内容（表格/分隔线），块独占一行 */
function insertBlockAtLineStart(value: string, selStart: number, block: string): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const newValue = value.slice(0, lineStart) + block + '\n' + value.slice(lineStart);
  return { value: newValue, start: lineStart, end: lineStart + block.length };
}

/** 应用格式命令（纯函数） */
export function applyEditorCommand(
  value: string,
  selStart: number,
  selEnd: number,
  cmd: EditorCommand,
): EditResult {
  switch (cmd) {
    case 'bold':
      return wrapSelection(value, selStart, selEnd, '**', '**', '加粗文字');
    case 'italic':
      return wrapSelection(value, selStart, selEnd, '*', '*', '斜体文字');
    case 'inlineCode':
      return wrapSelection(value, selStart, selEnd, '`', '`', 'code');
    case 'link':
      return wrapSelection(value, selStart, selEnd, '[', '](https://)', '链接文字');
    case 'h1':
      return toggleLinePrefix(value, selStart, selEnd, '# ');
    case 'h2':
      return toggleLinePrefix(value, selStart, selEnd, '## ');
    case 'h3':
      return toggleLinePrefix(value, selStart, selEnd, '### ');
    case 'quote':
      return toggleLinePrefix(value, selStart, selEnd, '> ');
    case 'ul':
      return toggleLinePrefix(value, selStart, selEnd, '- ');
    case 'ol':
      return toggleLinePrefix(value, selStart, selEnd, '1. ');
    case 'task':
      return toggleLinePrefix(value, selStart, selEnd, '- [ ] ');
    case 'codeBlock': {
      const selected = value.slice(selStart, selEnd) || '代码';
      const newValue = value.slice(0, selStart) + '```\n' + selected + '\n```' + value.slice(selEnd);
      return { value: newValue, start: selStart + 3, end: selStart + 3 + selected.length };
    }
    case 'table':
      return insertBlockAtLineStart(value, selStart, TABLE_TEMPLATE);
    case 'hr':
      return insertBlockAtLineStart(value, selStart, '---');
  }
}
