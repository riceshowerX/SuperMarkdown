/** 全局快捷键（UIUX-V2 §5.2/§5.6）：⌘K / ? / ⌘N / ⌘S / ⌘⇧T / Ctrl+Shift+T / ⌘\ / 格式命令 */

import { useEffect } from 'react';
import { useUiStore } from '../stores/ui.store';
import { useDocumentsStore } from '../stores/documents.store';
import { useEditorStore } from '../stores/editor.store';
import { runEditorCommand } from './editorCommandBus';
import { SHORTCUTS, matchesShortcut } from '../config/shortcuts';
import { resolveTheme } from '../theme/init';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      const ui = useUiStore.getState();

      // ⌘K 命令面板
      if (matchesShortcut(['meta', 'k'], e)) {
        e.preventDefault();
        ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
        return;
      }
      // ? 快捷键面板（输入中不触发）
      if (matchesShortcut(['shift', '?'], e) && !typing) {
        e.preventDefault();
        ui.setShortcutsOpen(!ui.shortcutsOpen);
        return;
      }
      // ⌘N 新建文档
      if (matchesShortcut(['meta', 'n'], e)) {
        e.preventDefault();
        void useDocumentsStore.getState().createDocument();
        return;
      }
      // ⌘S 手动保存
      if (matchesShortcut(['meta', 's'], e)) {
        e.preventDefault();
        void useEditorStore.getState().flushSave();
        return;
      }
      // ⌘⇧T 主题切换
      if (matchesShortcut(['meta', 'shift', 't'], e)) {
        e.preventDefault();
        const resolved = resolveTheme(ui.theme);
        ui.setTheme(resolved === 'dark' ? 'light' : 'dark');
        return;
      }
      // Ctrl+Shift+T 打字机模式
      if (matchesShortcut(['ctrl', 'shift', 't'], e)) {
        e.preventDefault();
        ui.toggleTypewriter();
        return;
      }
      // ⌘\ 循环视图
      if (matchesShortcut(['meta', '\\'], e)) {
        e.preventDefault();
        const next = ui.viewMode === 'split' ? 'edit' : ui.viewMode === 'edit' ? 'preview' : 'split';
        ui.setViewMode(next);
        return;
      }
      // 格式命令（编辑区可达时生效）
      for (const s of SHORTCUTS) {
        if (s.command && matchesShortcut(s.keys, e)) {
          e.preventDefault();
          runEditorCommand(s.command);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
