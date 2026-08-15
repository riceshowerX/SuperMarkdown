/** 快捷键唯一真源：工具栏 title / 命令面板 / 快捷键面板 / 全局按键监听 共用（UIUX-V2 §4.2/§5.2/§5.6） */

import type { EditorCommand } from '../utils/editor';

export type ShortcutGroup = '文档' | '编辑' | '视图' | '帮助';

export interface ShortcutDef {
  id: string;
  /** 编辑器格式命令（若是格式动作） */
  command?: EditorCommand;
  label: string;
  description: string;
  /** 按键序列（如 ['meta','shift','1'] / ['?'] / ['ctrl','shift','t']） */
  keys: string[];
  /** 展示文本（⌘B / Ctrl+Shift+T） */
  display: string;
  group: ShortcutGroup;
}

function isMac(): boolean {
  try {
    return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
  } catch {
    return false;
  }
}

/** 平台适配的展示文本（mac ⌘ / 其他 Ctrl+） */
function combo(keys: string[]): string {
  const mac = isMac();
  let out = '';
  if (keys.includes('meta')) out += mac ? '⌘' : 'Ctrl+';
  if (keys.includes('ctrl')) out += 'Ctrl+';
  if (keys.includes('alt')) out += mac ? '⌥' : 'Alt+';
  if (keys.includes('shift')) out += mac ? '⇧' : 'Shift+';
  const main = keys[keys.length - 1];
  out += main.toUpperCase();
  return out;
}

export const SHORTCUTS: ShortcutDef[] = [
  // ── 文档 ──
  { id: 'new-doc', label: '新建文档', description: '创建一篇新的空白文档', keys: ['meta', 'n'], display: combo(['meta', 'n']), group: '文档' },
  { id: 'palette', label: '命令面板', description: '搜索命令与文档', keys: ['meta', 'k'], display: combo(['meta', 'k']), group: '文档' },
  { id: 'save', label: '手动保存', description: '立即写入磁盘', keys: ['meta', 's'], display: combo(['meta', 's']), group: '文档' },

  // ── 编辑（格式） ──
  { id: 'bold', command: 'bold', label: '加粗', description: '包裹选中文本', keys: ['meta', 'b'], display: combo(['meta', 'b']), group: '编辑' },
  { id: 'italic', command: 'italic', label: '斜体', description: '包裹选中文本', keys: ['meta', 'i'], display: combo(['meta', 'i']), group: '编辑' },
  { id: 'inlineCode', command: 'inlineCode', label: '行内代码', description: '包裹选中文本', keys: ['meta', 'e'], display: combo(['meta', 'e']), group: '编辑' },
  { id: 'link', command: 'link', label: '链接', description: '插入链接', keys: ['meta', 'shift', 'l'], display: combo(['meta', 'shift', 'l']), group: '编辑' },
  { id: 'h1', command: 'h1', label: '一级标题', description: '当前行设为 H1', keys: ['meta', 'shift', '1'], display: combo(['meta', 'shift', '1']), group: '编辑' },
  { id: 'h2', command: 'h2', label: '二级标题', description: '当前行设为 H2', keys: ['meta', 'shift', '2'], display: combo(['meta', 'shift', '2']), group: '编辑' },
  { id: 'quote', command: 'quote', label: '引用', description: '当前行设为引用', keys: ['meta', 'shift', 'q'], display: combo(['meta', 'shift', 'q']), group: '编辑' },
  { id: 'codeBlock', command: 'codeBlock', label: '代码块', description: '包裹代码块', keys: ['meta', 'shift', 'c'], display: combo(['meta', 'shift', 'c']), group: '编辑' },
  { id: 'ul', command: 'ul', label: '无序列表', description: '当前行设为无序列表', keys: ['meta', 'shift', 'u'], display: combo(['meta', 'shift', 'u']), group: '编辑' },
  { id: 'ol', command: 'ol', label: '有序列表', description: '当前行设为有序列表', keys: ['meta', 'shift', 'o'], display: combo(['meta', 'shift', 'o']), group: '编辑' },
  { id: 'task', command: 'task', label: '任务列表', description: '当前行设为任务列表', keys: ['meta', 'shift', 'r'], display: combo(['meta', 'shift', 'r']), group: '编辑' },

  // ── 视图 ──
  { id: 'theme', label: '切换主题', description: '明暗主题切换', keys: ['meta', 'shift', 't'], display: combo(['meta', 'shift', 't']), group: '视图' },
  { id: 'typewriter', label: '打字机模式', description: '光标行居中滚动', keys: ['ctrl', 'shift', 't'], display: 'Ctrl+Shift+T', group: '视图' },
  { id: 'view-cycle', label: '循环视图', description: '分屏 / 仅编辑 / 仅预览', keys: ['meta', '\\'], display: combo(['meta', '\\']), group: '视图' },

  // ── 帮助 ──
  { id: 'help', label: '快捷键面板', description: '查看全部快捷键', keys: ['shift', '?'], display: '?', group: '帮助' },
];

/** 取某个编辑器命令对应的快捷键定义 */
export function getCommandShortcut(cmd: EditorCommand): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.command === cmd);
}

/**
 * 按键匹配（供全局 keydown 使用）
 * 语义：`meta` = 主修饰键（Mac ⌘ / 其他平台 Ctrl）；`ctrl` = 字面 Ctrl（跨平台一致）；
 * 无主修饰键时不允许 Ctrl/⌘ 按下。
 */
export function matchesShortcut(keys: string[], e: KeyboardEvent): boolean {
  const mac = isMac();
  const main = keys[keys.length - 1].toLowerCase();
  const wantMeta = keys.includes('meta');
  const wantCtrl = keys.includes('ctrl');
  const wantAlt = keys.includes('alt');
  const wantShift = keys.includes('shift');

  if (wantMeta) {
    const primary = mac ? e.metaKey : e.ctrlKey;
    if (!primary) return false;
  } else if (wantCtrl) {
    if (!e.ctrlKey) return false;
  } else {
    if (e.ctrlKey || e.metaKey) return false;
  }

  if (wantAlt !== e.altKey) return false;
  if (wantShift !== e.shiftKey) return false;
  return e.key.toLowerCase() === main;
}
