import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor.store';
import { writeCrashBuffer } from '../services/storage/storage.service';

/**
 * 自动保存生命周期桥接（架构 §10.1）
 * 核心调度在 editor.store（防抖 800ms 写盘），本 hook 负责：
 * - beforeunload / pagehide / visibilitychange(hidden) 时 flush 待保存内容（AC-04：意外关闭不丢稿）
 * - SM-09：关窗前异步 IndexedDB 事务可能被中止，故先同步写一份 localStorage 兜底缓冲
 *   （必须带 docId，启动时由 documents.store.initialize 校验归属后恢复）
 */

/** 关窗/隐藏兜底：能同步落盘的先落盘（crash buffer），再尝试异步正式写入 */
function flushOrBuffer(): void {
  const st = useEditorStore.getState();
  if (!st.docId) return;
  if (st.revision > st.lastSavedRevision) {
    writeCrashBuffer({
      docId: st.docId,
      content: st.content,
      revision: st.revision,
      ts: Date.now(),
    });
    void st.flushSave();
  }
}

export function useAutoSave(): void {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushOrBuffer();
    };
    window.addEventListener('beforeunload', flushOrBuffer);
    window.addEventListener('pagehide', flushOrBuffer);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushOrBuffer);
      window.removeEventListener('pagehide', flushOrBuffer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
