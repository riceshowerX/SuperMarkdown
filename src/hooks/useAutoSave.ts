import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor.store';

/**
 * 自动保存生命周期桥接（架构 §10.1）
 * 核心调度在 editor.store（防抖 800ms 写盘），本 hook 负责：
 * - beforeunload 时 flush 待保存内容（AC-04：意外关闭不丢稿）
 */
export function useAutoSave(): void {
  useEffect(() => {
    const onBeforeUnload = () => {
      const st = useEditorStore.getState();
      if (st.docId && st.revision > st.lastSavedRevision) {
        void st.flushSave();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}
