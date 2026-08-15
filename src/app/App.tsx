import { useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import ConfirmModal from '../components/common/ConfirmModal';
import Toasts from '../components/common/Toasts';
import CommandPalette from '../components/common/CommandPalette';
import ShortcutsPanel from '../components/common/ShortcutsPanel';
import { useDocumentsStore } from '../stores/documents.store';
import { useEditorStore } from '../stores/editor.store';
import { useAutoSave } from '../hooks/useAutoSave';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';

/** 根组件：只装配（<100 行，无业务逻辑） */
export default function App() {
  const initialize = useDocumentsStore((s) => s.initialize);
  const activeDocId = useDocumentsStore((s) => s.activeDocId);

  // 启动加载文档
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // 切换/加载当前文档内容（加载失败保持旧内容，不抛错）
  useEffect(() => {
    if (!activeDocId) return;
    const documents = useDocumentsStore.getState().documents;
    const doc = documents.find((d) => d.id === activeDocId);
    if (doc) {
      useEditorStore.getState().loadDocument(doc);
    }
  }, [activeDocId]);

  useAutoSave();
  useGlobalShortcuts();

  return (
    <>
      <AppShell />
      <ConfirmModal />
      <Toasts />
      <CommandPalette />
      <ShortcutsPanel />
    </>
  );
}
