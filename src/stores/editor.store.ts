import { create } from 'zustand';
import type { Document, SaveStatus } from '../types/models';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_SAVE_RETRIES,
  SAVED_IDLE_MS,
} from '../config/constants';
import { getStorageService } from '../services/storage/storage.service';
import { nextTitle } from '../utils/title';
import { toAppError } from '../utils/errors';
import { exportHtml } from '../services/export/export.service';
import { useDocumentsStore } from './documents.store';
import { useUiStore } from './ui.store';

/** 模块级防抖计时器（串行化保存，旧写不覆盖新写） */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { content: string; revision: number } | null = null;

interface EditorState {
  docId: string | null;
  content: string;
  /** 内容版本号（内存自增），保存竞态防护用 */
  revision: number;
  lastSavedRevision: number;
  saveStatus: SaveStatus;
  failCount: number;

  loadDocument: (doc: Document) => void;
  clearDocument: () => void;
  setContent: (content: string) => void;
  scheduleSave: () => void;
  flushSave: () => Promise<void>;
  retrySave: () => Promise<void>;
  resetSaveState: () => void;
}

function scheduleSaveIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (useEditorStore.getState().saveStatus === 'saved') {
      useEditorStore.setState({ saveStatus: 'idle' });
    }
  }, SAVED_IDLE_MS);
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  docId: null,
  content: '',
  revision: 0,
  lastSavedRevision: 0,
  saveStatus: 'idle',
  failCount: 0,

  loadDocument: (doc) => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pending = null;
    set({
      docId: doc.id,
      content: doc.content,
      revision: 0,
      lastSavedRevision: 0,
      saveStatus: 'idle',
      failCount: 0,
    });
  },

  clearDocument: () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pending = null;
    set({ docId: null, content: '', revision: 0, lastSavedRevision: 0, saveStatus: 'idle', failCount: 0 });
  },

  setContent: (content) => {
    set({ content, revision: get().revision + 1 });
    get().scheduleSave();
  },

  scheduleSave: () => {
    const st = get();
    if (!st.docId) return;
    pending = { content: st.content, revision: st.revision };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void useEditorStore.getState().flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  },

  flushSave: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const st = get();
    if (!pending || !st.docId) return;
    if (pending.revision <= st.lastSavedRevision) {
      pending = null;
      return;
    }
    if (st.saveStatus === 'saving') return; // 在途写入，完成后 finally 会检查新 pending
    const payload = pending;
    pending = null;
    set({ saveStatus: 'saving' });
    try {
      const docs = useDocumentsStore.getState().documents;
      const existing = docs.find((d) => d.id === st.docId);
      const title = nextTitle(payload.content, existing?.title ?? '', docs.length);
      await (await getStorageService()).updateDocument({ id: st.docId, title, content: payload.content });
      set({ saveStatus: 'saved', lastSavedRevision: payload.revision, failCount: 0 });
      scheduleSaveIdle();
      await useDocumentsStore.getState().refreshList();
    } catch (err) {
      const failCount = get().failCount + 1;
      set({ saveStatus: 'error', failCount });
      if (failCount >= MAX_SAVE_RETRIES) {
        const docId = st.docId;
        const failedContent = payload.content;
        const docs = useDocumentsStore.getState().documents;
        const base = docs.find((d) => d.id === docId);
        useUiStore.getState().pushToast({
          kind: 'error',
          title: '保存失败',
          message: '连续多次写入失败，建议导出备份以防丢失',
          actionLabel: '导出备份',
          onAction: () => {
            void exportHtml({
              id: docId,
              title: base?.title ?? '无标题文档',
              content: failedContent,
              createdAt: base?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            });
          },
        });
      }
      console.error('[SuperMarkdown] save failed:', toAppError(err).message);
    } finally {
      if (pending && get().docId) {
        saveTimer = setTimeout(() => void get().flushSave(), 50);
      }
    }
  },

  retrySave: async () => {
    // 失败时 pending 已置空；从当前内存内容重建快照后再保存，使手动重试真正生效
    const st = get();
    if (!st.docId) return;
    if (st.revision > st.lastSavedRevision) {
      pending = { content: st.content, revision: st.revision };
    }
    await get().flushSave();
  },

  resetSaveState: () => {
    set({ saveStatus: 'idle', failCount: 0 });
  },
}));
