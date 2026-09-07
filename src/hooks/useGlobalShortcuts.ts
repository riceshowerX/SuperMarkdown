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
      const ui = useUiStore.getState();
      // SM-45：确认框打开时全局快捷键一律短路，避免 Enter/方向键误触发对话框之外的动作
      if (ui.confirm) return;
      const typing = isTypingTarget(e.target);

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
      // Ctrl+Shift+T 打字机模式（SM-07：置于主题切换之前——非 Mac 下 meta 即 Ctrl，两键冲突时打字机优先）
      if (matchesShortcut(['ctrl', 'shift', 't'], e)) {
        e.preventDefault();
        ui.toggleTypewriter();
        return;
      }
      // ⌘⇧T 主题切换（SM-07：排除字面 Ctrl——非 Mac 下与打字机同键，主题快捷键仅 Mac 生效）
      if (matchesShortcut(['meta', 'shift', 't'], e) && !e.ctrlKey) {
        e.preventDefault();
        const resolved = resolveTheme(ui.theme);
        ui.setTheme(resolved === 'dark' ? 'light' : 'dark');
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
