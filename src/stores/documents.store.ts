import { create } from 'zustand';
import type { Document } from '../types/models';
import { getStorageService, readCrashBuffer, clearCrashBuffer } from '../services/storage/storage.service';
import { openLocalMarkdown } from '../services/desktop/desktop.service';
import { toAppError, AppError } from '../utils/errors';
import { useEditorStore } from './editor.store';
import { useUiStore } from './ui.store';
import { removeRecent } from '../components/common/paletteItems';

interface DocumentsState {
  documents: Document[];
  activeDocId: string | null;
  loaded: boolean;
  loading: boolean;
  /** SM-43/71：删除互斥锁，防止连点删除/删除+切换并发互踩 */
  deleting: boolean;
  fallbackMode: boolean;
  searchQuery: string;
  initError: string | null;

  initialize: () => Promise<void>;
  refreshList: () => Promise<void>;
  createDocument: () => Promise<string | null>;
  /** 打开本地 .md 导入为新文档（Electron IPC / Web 文件选择器，取消则静默） */
  openLocalMarkdownFile: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => Promise<void>;
  setActiveDocId: (id: string | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  resetSearch: () => void;
}

/**
 * SM-18：生成不与现有文档重名的「无标题文档 N」标题。
 * 此前用 `docs.length + 1` 编号，删除中间文档后再新建必然撞名。
 */
function uniqueUntitledTitle(docs: Document[]): string {
  const base = '无标题文档';
  const titles = new Set(docs.map((d) => d.title));
  if (!titles.has(base)) return `${base} 1`;
  let i = 2;
  while (titles.has(`${base} ${i}`)) i += 1;
  return `${base} ${i}`;
}

/** SM-70：文档切换代际。flushSave 是异步的，期间用户可能又点了别的文档；过期结果直接作废。 */
let switchSeq = 0;

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  documents: [],
  activeDocId: null,
  loaded: false,
  loading: false,
  deleting: false,
  fallbackMode: false,
  searchQuery: '',
  initError: null,

  initialize: async () => {
    // SM-05：加载失败（loaded:false + initError）时允许重试；
    // 此前 catch 里误置 loaded:true，把"初始化失败"固化成"已完成"，App 不再重试
    if (get().loading) return;
    if (get().loaded && !get().initError) return;
    set({ loading: true, initError: null });
    try {
      const storage = await getStorageService();
      let docs = await storage.listDocuments();
      let activeDocId: string | null = null;
      if (docs.length === 0) {
        const doc = await storage.createDocument({ title: '无标题文档 1', content: '' });
        docs = [doc];
        activeDocId = doc.id;
      } else {
        activeDocId = docs[0].id; // 最近编辑优先
      }

      // SM-09：关窗兜底缓冲恢复——上次关闭时未来得及落盘的内容在启动时写回
      let recoveredDocId: string | null = null;
      const buffer = readCrashBuffer();
      if (buffer) {
        const target = docs.find((d) => d.id === buffer.docId);
        if (!target) {
          // 目标文档已不存在（删除后崩溃），缓冲作废
          clearCrashBuffer(buffer.docId);
        } else if (target.content === buffer.content) {
          // 内容已一致（上次其实保存成功了），直接清缓冲
          clearCrashBuffer(buffer.docId);
        } else {
          try {
            await storage.updateDocument({ id: target.id, content: buffer.content });
            docs = docs.map((d) =>
              d.id === target.id ? { ...d, content: buffer.content, updatedAt: Date.now() } : d,
            );
            clearCrashBuffer(buffer.docId);
            recoveredDocId = target.id;
          } catch (err) {
            // 恢复失败保留缓冲（下次启动重试），不阻塞正常启动
            console.error('[SuperMarkdown] crash buffer recovery failed:', toAppError(err).message);
            useUiStore.getState().pushToast({
              kind: 'error',
              title: '内容恢复失败',
              message: '上次未保存的内容已保留，将在下次启动时重试恢复',
            });
          }
        }
      }
      if (recoveredDocId) {
        activeDocId = recoveredDocId; // 让用户第一时间看到被恢复的内容
      }

      set({ documents: docs, activeDocId, loaded: true, loading: false, fallbackMode: storage.isFallbackMode() });
      if (recoveredDocId) {
        useUiStore.getState().pushToast({
          kind: 'success',
          title: '已恢复',
          message: '已恢复上次退出时未保存的内容',
        });
      }
      if (storage.isFallbackMode()) {
        useUiStore.getState().pushToast({
          kind: 'info',
          title: '临时存储模式',
          message: '浏览器不支持 IndexedDB，文档将保存在临时存储中，数据可能丢失',
        });
      }
    } catch (err) {
      const appErr = toAppError(err);
      set({ loading: false, loaded: false, initError: appErr.userMessage });
      useUiStore.getState().pushToast({ kind: 'error', title: '加载失败', message: appErr.userMessage });
    }
  },

  refreshList: async () => {
    try {
      const storage = await getStorageService();
      const docs = await storage.listDocuments();
      set({ documents: docs, fallbackMode: storage.isFallbackMode() });
    } catch (err) {
      console.error('[SuperMarkdown] refresh list failed:', toAppError(err).message);
    }
  },

  createDocument: async () => {
    try {
      // 切换前 flush 当前文档待保存内容（不丢稿）；flush 失败则中止新建，
      // 避免在写失败（如磁盘满）状态下继续产生新文档
      const ok = await useEditorStore.getState().flushSave();
      if (!ok) {
        throw new AppError('SAVE_FAILED', '当前文档保存失败，已取消新建以保护未保存内容');
      }
      const storage = await getStorageService();
      const docs = get().documents;
      const title = uniqueUntitledTitle(docs); // SM-18
      const doc = await storage.createDocument({ title, content: '' });
      const next = [doc, ...docs].sort((a, b) => b.updatedAt - a.updatedAt);
      set({ documents: next, activeDocId: doc.id });
      useUiStore.getState().pushToast({ kind: 'success', title: '已创建', message: title });
      return doc.id;
    } catch (err) {
      const appErr = toAppError(err);
      useUiStore.getState().pushToast({ kind: 'error', title: '新建失败', message: appErr.userMessage });
      return null;
    }
  },

  openLocalMarkdownFile: async () => {
    try {
      // 切换前 flush 当前文档待保存内容（不丢稿）
      const ok = await useEditorStore.getState().flushSave();
      if (!ok) {
        throw new AppError('SAVE_FAILED', '当前文档保存失败，已取消导入以保护未保存内容');
      }
      const file = await openLocalMarkdown();
      if (!file) return; // 用户取消，静默
      const storage = await getStorageService();
      const docs = get().documents;
      const title = file.title || uniqueUntitledTitle(docs); // SM-18
      const doc = await storage.createDocument({ title, content: file.content });
      const next = [doc, ...docs].sort((a, b) => b.updatedAt - a.updatedAt);
      set({ documents: next, activeDocId: doc.id });
      useUiStore.getState().pushToast({ kind: 'success', title: '已导入', message: title });
    } catch (err) {
      const appErr = toAppError(err);
      useUiStore.getState().pushToast({ kind: 'error', title: '打开失败', message: appErr.userMessage });
    }
  },

  deleteDocument: async (id) => {
    // SM-43/71：删除互斥锁——连点删除或"删除中切文档"时直接拒绝，
    // 此前两次并发删除会各自基于旧列表计算 remaining，导致幽灵文档/错位切换
    if (get().deleting) return;
    set({ deleting: true });
    try {
      // 删除前 flush 当前文档（删除当前文档时保留其未保存内容到存储再删）；
      // SM-72：flush 失败（写不进去）时禁止删除，否则未落盘的修改将随文档一起丢失
      const ok = await useEditorStore.getState().flushSave();
      if (!ok) {
        throw new AppError('SAVE_FAILED', '当前文档保存失败，已取消删除以保护未保存内容');
      }
      const storage = await getStorageService();
      await storage.deleteDocument(id); // 失败向上抛，调用方 toast，列表不变

      // SM-71：storage.deleteDocument 是异步的，此处必须以删除完成后的最新列表为准，
      // 不能复用 await 之前捕获的快照
      const remaining = get().documents.filter((d) => d.id !== id);
      let docs = remaining;
      let activeDocId = get().activeDocId;

      // SM-06：同步清理「最近使用」记录，避免命令面板残留失效入口与已删标题明文
      removeRecent(id);
      // 兜底：若崩溃缓冲恰好指向被删文档，一并清掉
      clearCrashBuffer(id);

      if (activeDocId === id) {
        if (remaining.length === 0) {
          // 列表为空自动新建（AC-08）；SM-18：标题去重
          const doc = await storage.createDocument({ title: uniqueUntitledTitle(remaining), content: '' });
          docs = [doc];
          activeDocId = doc.id;
          useEditorStore.getState().loadDocument(doc);
        } else {
          // 切换到相邻文档（原位置或前一位）；编辑器内容由 App 的 activeDocId 副作用加载
          const idx = get().documents.findIndex((d) => d.id === id);
          const adjacent = remaining[Math.min(idx, remaining.length - 1)] ?? remaining[remaining.length - 1];
          activeDocId = adjacent.id;
        }
      }
      set({ documents: docs, activeDocId });
    } finally {
      set({ deleting: false });
    }
  },

  renameDocument: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const storage = await getStorageService();
    await storage.updateDocument({ id, title: trimmed });
    const next = get()
      .documents.map((d) => (d.id === id ? { ...d, title: trimmed, updatedAt: Date.now() } : d))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    set({ documents: next });
    useUiStore.getState().pushToast({ kind: 'success', title: '已重命名', message: trimmed });
  },

  setActiveDocId: async (id) => {
    if (id === get().activeDocId) return;
    // SM-70：切换代际令牌。下面 await flushSave 期间用户可能又点了另一篇文档，
    // 本轮切换已过期，恢复现场直接返回（此前无保护，慢存储上连点会乱序收敛到后点文档之前的某篇）
    const seq = ++switchSeq;
    // 切换前 flush 当前文档待保存内容（AC-04：切文档不丢稿）；
    // flush 失败时中止切换，当前未保存内容继续留在编辑器内，避免丢稿
    const ok = await useEditorStore.getState().flushSave();
    if (seq !== switchSeq) return;
    if (!ok) {
      useUiStore.getState().pushToast({
        kind: 'error',
        title: '切换已取消',
        message: '当前文档保存失败，请先处理保存错误后再切换文档',
      });
      return;
    }
    set({ activeDocId: id });
    if (!id) {
      useEditorStore.getState().clearDocument();
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  resetSearch: () => set({ searchQuery: '' }),
}));
