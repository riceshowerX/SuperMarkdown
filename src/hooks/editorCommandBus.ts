/** 编辑器命令总线：命令面板/全局快捷键在 EditorPane 之外触发格式命令（UIUX-V2 §5.2） */

import type { EditorCommand } from '../utils/editor';

type CommandFn = (cmd: EditorCommand) => void;
type InsertFn = (text: string) => void;

let applyCommand: CommandFn | null = null;
let insertAtCursor: InsertFn | null = null;

/** EditorPane 挂载时注册（其 applyCommand/insertAtCursor 依赖 textarea 实例） */
export function registerEditorActions(command: CommandFn, insert: InsertFn): void {
  applyCommand = command;
  insertAtCursor = insert;
}

export function unregisterEditorActions(): void {
  applyCommand = null;
  insertAtCursor = null;
}

/** 执行格式命令；无编辑器实例（如仅预览视图）返回 false */
export function runEditorCommand(cmd: EditorCommand): boolean {
  if (!applyCommand) return false;
  applyCommand(cmd);
  return true;
}

/** 光标处插入文本（图片等） */
export function insertAtCursorBus(text: string): boolean {
  if (!insertAtCursor) return false;
  insertAtCursor(text);
  return true;
}
