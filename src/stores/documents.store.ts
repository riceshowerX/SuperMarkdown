import { create } from 'zustand';
import type { Document } from '../types/models';
import { getStorageService } from '../services/storage/storage.service';
import { toAppError } from '../utils/errors';
import { useEditorStore } from './editor.store';
import { useUiStore } from './ui.store';

interface DocumentsState {
  documents: Document[];
  activeDocId: string | null;
  loaded: boolean;
  loading: boolean;
  fallbackMode: boolean;
  searchQuery: string;
  initError: string | null;

  initialize: () => Promise<void>;
  refreshList: () => Promise<void>;
  createDocument: () => Promise<string | null>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => Promise<void>;
  setActiveDocId: (id: string | null) => Promise<void>;
  setSearchQuery: (query: string) => void;
  resetSearch: () => void;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  documents: [],
  activeDocId: null,
  loaded: false,
  loading: false,
  fallbackMode: false,
  searchQuery: '',
  initError: null,

  initialize: async () => {
    if (get().loaded || get().loading) return;
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
      set({ documents: docs, activeDocId, loaded: true, loading: false, fallbackMode: storage.isFallbackMode() });
      if (storage.isFallbackMode()) {
        useUiStore.getState().pushToast({
          kind: 'info',
          title: '临时存储模式',
          message: '浏览器不支持 IndexedDB，文档将保存在临时存储中，数据可能丢失',
        });
      }
    } catch (err) {
      const appErr = toAppError(err);
      set({ loading: false, loaded: true, initError: appErr.userMessage });
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
      // 切换前 flush 当前文档待保存内容（不丢稿）
      await useEditorStore.getState().flushSave();
      const storage = await getStorageService();
      const docs = get().documents;
      const title = `无标题文档 ${docs.length + 1}`;
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

  deleteDocument: async (id) => {
    // 删除前 flush 当前文档（删除当前文档时保留其未保存内容到存储再删，失败不丢）
    await useEditorStore.getState().flushSave();
    const storage = await getStorageService();
    // flush 可能已刷新列表排序，此处以最新列表为准
    const prev = get().documents;
    await storage.deleteDocument(id); // 失败向上抛，调用方 toast，列表不变
    const remaining = prev.filter((d) => d.id !== id);
    let docs = remaining;
    let activeDocId = get().activeDocId;

    if (activeDocId === id) {
      if (remaining.length === 0) {
        // 列表为空自动新建（AC-08）
        const doc = await storage.createDocument({ title: '无标题文档 1', content: '' });
        docs = [doc];
        activeDocId = doc.id;
        useEditorStore.getState().loadDocument(doc);
      } else {
        // 切换到相邻文档（原位置或前一位）
        const idx = prev.findIndex((d) => d.id === id);
        const adjacent = remaining[Math.min(idx, remaining.length - 1)] ?? remaining[remaining.length - 1];
        activeDocId = adjacent.id;
      }
    }
    set({ documents: docs, activeDocId });
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
    // 切换前 flush 当前文档待保存内容（AC-04：切文档不丢稿）
    await useEditorStore.getState().flushSave();
    set({ activeDocId: id });
    if (!id) {
      useEditorStore.getState().clearDocument();
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  resetSearch: () => set({ searchQuery: '' }),
}));
