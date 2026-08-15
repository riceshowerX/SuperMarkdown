/** 命令面板条目构建与分组（纯逻辑，UIUX-V2 §5.2；与渲染解耦便于瘦身与测试） */

import type { LucideIcon } from 'lucide-react';
import {
  Columns2,
  Eye,
  FileCode2,
  FilePlus2,
  FileText,
  Focus,
  Keyboard,
  Moon,
  PencilLine,
  Sun,
} from 'lucide-react';
import { SHORTCUTS } from '../../config/shortcuts';
import type { EditorCommand } from '../../utils/editor';
import type { Document, Theme, ViewMode } from '../../types/models';

export interface RecentDoc {
  id: string;
  title: string;
}

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: LucideIcon;
  keywords: string;
  onSelect: () => void;
}

export const RECENT_KEY = 'sm-recent-docs';
export const MAX_RECENT = 6;

export function readRecent(): RecentDoc[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    if (Array.isArray(parsed)) {
      return parsed.filter((r): r is RecentDoc => !!r && typeof r.id === 'string' && typeof r.title === 'string');
    }
  } catch {
    /* 忽略 */
  }
  return [];
}

export function writeRecent(list: RecentDoc[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* 忽略 */
  }
}

export function recordRecent(id: string, title: string): void {
  writeRecent([{ id, title }, ...readRecent().filter((r) => r.id !== id)]);
}

export interface BuildItemsDeps {
  query: string;
  documents: Document[];
  recent: RecentDoc[];
  theme: Theme;
  resolvedDark: boolean;
  typewriterMode: boolean;
  createDocument: () => void;
  exportHtml: () => void;
  exportTxt: () => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  toggleTypewriter: () => void;
  openShortcuts: () => void;
  openDoc: (id: string, title: string) => void;
  runFormat: (cmd: EditorCommand) => void;
}

const GROUP_ORDER = ['最近使用', '动作', '视图', '格式', '文档跳转', '主题切换', '帮助'];

/** 构建全量条目并按固定组序分组（过滤后） */
export function buildPaletteItems(deps: BuildItemsDeps): PaletteItem[] {
  const q = deps.query.trim().toLowerCase();
  const dark = deps.resolvedDark;

  const recentItems: PaletteItem[] = (q ? [] : deps.recent).map((r) => ({
    id: `recent-${r.id}`,
    label: r.title,
    hint: '最近',
    group: '最近使用',
    icon: FileText,
    keywords: r.title.toLowerCase(),
    onSelect: () => deps.openDoc(r.id, r.title),
  }));

  const actionItems: PaletteItem[] = [
    {
      id: 'action-new',
      label: '新建文档',
      hint: '⌘N',
      group: '动作',
      icon: FilePlus2,
      keywords: 'new 新建 文档',
      onSelect: deps.createDocument,
    },
    {
      id: 'action-export-html',
      label: '导出 HTML',
      group: '动作',
      icon: FileCode2,
      keywords: 'export html 导出',
      onSelect: deps.exportHtml,
    },
    {
      id: 'action-export-txt',
      label: '导出纯文本',
      group: '动作',
      icon: FileText,
      keywords: 'export txt text 导出 文本',
      onSelect: deps.exportTxt,
    },
    {
      id: 'view-split',
      label: '视图：分屏',
      hint: '⌘\\',
      group: '视图',
      icon: Columns2,
      keywords: 'split 分屏 view 视图',
      onSelect: () => deps.setViewMode('split'),
    },
    {
      id: 'view-edit',
      label: '视图：仅编辑',
      group: '视图',
      icon: PencilLine,
      keywords: 'edit 编辑 view 视图',
      onSelect: () => deps.setViewMode('edit'),
    },
    {
      id: 'view-preview',
      label: '视图：仅预览',
      group: '视图',
      icon: Eye,
      keywords: 'preview 预览 view 视图',
      onSelect: () => deps.setViewMode('preview'),
    },
    {
      id: 'theme',
      label: dark ? '切换为明亮主题' : '切换为暗色主题',
      hint: '⌘⇧T',
      group: '主题切换',
      icon: dark ? Sun : Moon,
      keywords: 'theme 主题 dark light 暗色 明亮',
      onSelect: () => deps.setTheme(dark ? 'light' : 'dark'),
    },
    {
      id: 'typewriter',
      label: deps.typewriterMode ? '关闭打字机模式' : '开启打字机模式',
      hint: 'Ctrl+Shift+T',
      group: '视图',
      icon: Focus,
      keywords: 'typewriter 打字机 focus 专注',
      onSelect: deps.toggleTypewriter,
    },
    {
      id: 'help',
      label: '快捷键面板',
      hint: '?',
      group: '帮助',
      icon: Keyboard,
      keywords: 'help 快捷键 shortcut 帮助',
      onSelect: deps.openShortcuts,
    },
  ];

  const formatItems: PaletteItem[] = SHORTCUTS.filter((s) => s.command).map((s) => ({
    id: `fmt-${s.id}`,
    label: s.label,
    hint: s.display,
    group: '格式',
    icon: FileText,
    keywords: `${s.label} ${s.description} ${s.group}`,
    onSelect: () => deps.runFormat(s.command as EditorCommand),
  }));

  const docItems: PaletteItem[] = deps.documents
    .filter((d) => !q || d.title.toLowerCase().includes(q))
    .map((d) => ({
      id: `doc-${d.id}`,
      label: d.title,
      group: '文档跳转',
      icon: FileText,
      keywords: d.title.toLowerCase(),
      onSelect: () => deps.openDoc(d.id, d.title),
    }));

  const base = [...recentItems, ...actionItems, ...formatItems, ...docItems];
  if (!q) return base;
  return base.filter((i) => i.keywords.toLowerCase().includes(q) || i.label.toLowerCase().includes(q));
}

/** 按固定组序分组（空组跳过），供渲染层使用 */
export function groupPaletteItems(items: PaletteItem[]): Array<{ label: string; items: PaletteItem[] }> {
  const map = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
}
