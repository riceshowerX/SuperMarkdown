import { create } from 'zustand';
import type { Document, SaveStatus } from '../types/models';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_SAVE_RETRIES,
  SAVED_IDLE_MS,
} from '../config/constants';
import { clearCrashBuffer, getStorageService } from '../services/storage/storage.service';
import { nextTitle } from '../utils/title';
import { toAppError } from '../utils/errors';
import { exportHtml } from '../services/export/export.service';
import { useDocumentsStore } from './documents.store';
import { useUiStore } from './ui.store';

/** 模块级防抖计时器（串行化保存，旧写不覆盖新写） */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 待写快照（SM-01）：必须携带 docId。
 * 切换文档后 flushSave 会丢弃异文档残留，杜绝"旧文档内容写入新文档"的跨文档覆盖；
 * 此前该风险仅靠 loadDocument 里一行 pending = null 兜着，属隐式依赖。
 */
let pending: { docId: string; content: string; revision: number } | null = null;

/**
 * 编辑器会话代际（SM-01）：loadDocument / clearDocument 自增。
 * 在途保存完成后用 saveGeneration !== sessionGen 判定会话已失效，
 * 结果整体作废——不污染新会话的 lastSavedRevision / saveStatus。
 * 这是"切走再切回"场景的唯一可靠判据（此时 docId 相同但会话已被重置）。
 */
let saveGeneration = 0;

/**
 * 保存串行链（SM-01 初版采用 Promise 链排队，验证阶段废弃）：
 * 排队会让后续保存被一次"永不落定"的写入永久阻塞（测试与生产皆然）。
 * 竞态防护由「世代号 + docId 校验 + 删除后 clearDocument」承担；
 * 在途时 flushSave 早退，由 finally 续写定时器补盘（与旧实现等价，且可自然排空）。
 */

/** 首次保存成功 Toast 一次性标记（UIUX-V2 §5.5：防骚扰） */
let firstSaveToastSent = false;

/** 「导出备份」错误 Toast 只发一次标记（SM-08：连续失败时避免每次重试都弹） */
let backupToastSent = false;

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
  /** 成功或无需保存返回 true；写入失败返回 false（SM-72 依赖该布尔决定是否允许删除） */
  flushSave: () => Promise<boolean>;
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

/**
 * SM-01：写入完成后若有同会话的待写内容，安排 50ms 后续写。
 * 独立成模块级函数：在新作用域重新读取 pending，避免 TS 对
 * "闭包内 pending = null 赋值收窄" 在 finally 中的误判（把 pending 判成 never）。
 */
function scheduleFollowupSave(sessionDocId: string) {
  const next = pending;
  if (next && next.docId === sessionDocId && useEditorStore.getState().docId === sessionDocId) {
    saveTimer = setTimeout(() => void useEditorStore.getState().flushSave(), 50);
  }
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
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    pending = null;
    saveGeneration += 1; // SM-01：使所有在途保存结果对本会话失效
    firstSaveToastSent = false;
    backupToastSent = false;
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
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    pending = null;
    saveGeneration += 1; // SM-01
    firstSaveToastSent = false;
    backupToastSent = false;
    set({ docId: null, content: '', revision: 0, lastSavedRevision: 0, saveStatus: 'idle', failCount: 0 });
  },

  setContent: (content) => {
    set({ content, revision: get().revision + 1 });
    get().scheduleSave();
  },

  scheduleSave: () => {
    const st = get();
    if (!st.docId) return;
    // SM-01：快照必须绑定 docId
    pending = { docId: st.docId, content: st.content, revision: st.revision };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void useEditorStore.getState().flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  },

  flushSave: async () => {
    const run = async (): Promise<boolean> => {
      const st = get();
      if (!st.docId) return true;
      // SM-01：丢弃异文档残留（防跨文档内容覆盖）
      if (pending && pending.docId !== st.docId) pending = null;
      if (!pending) return true;
      if (pending.revision <= st.lastSavedRevision) {
        pending = null;
        return true;
      }

      const payload = pending;
      const sessionDocId = st.docId;
      const sessionGen = saveGeneration;
      pending = null;
      set({ saveStatus: 'saving' });
      try {
        const docs = useDocumentsStore.getState().documents;
        const existing = docs.find((d) => d.id === sessionDocId);
        const title = nextTitle(payload.content, existing?.title ?? '', docs.length);
        await (await getStorageService()).updateDocument({ id: sessionDocId, title, content: payload.content });

        // SM-01：会话已切换/重载 → 本次结果整体作废，不污染新会话状态
        if (saveGeneration !== sessionGen) return true;

        set({ saveStatus: 'saved', lastSavedRevision: payload.revision, failCount: 0 });
        // SM-09：正式保存成功后清掉该文档的兜底缓冲
        clearCrashBuffer(sessionDocId);
        scheduleSaveIdle();
        // 首次保存成功发一条一次性 Toast（有实际内容才提示，空文档不打扰）
        if (!firstSaveToastSent && payload.content.trim() !== '') {
          firstSaveToastSent = true;
          useUiStore.getState().pushToast({ kind: 'success', title: '已自动保存' });
        }
        await useDocumentsStore.getState().refreshList();
        return true;
      } catch (err) {
        console.error('[SuperMarkdown] save failed:', toAppError(err).message);
        if (saveGeneration !== sessionGen) return false;
        const failCount = get().failCount + 1;
        set({ saveStatus: 'error', failCount });
        if (failCount >= MAX_SAVE_RETRIES && !backupToastSent) {
          backupToastSent = true; // SM-08：导出备份提示只发一次
          const docId = sessionDocId;
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
        return false;
      } finally {
        // SM-01：仅同会话内仍有待写内容时续写（异会话残留已在下次 flushSave 开头丢弃）
        scheduleFollowupSave(sessionDocId);
      }
    };

    const st = get();
    if (!st.docId) return true;
    // 在途写入中：不排队（避免一次永不落定的写入锁死后续所有保存）。
    // 若存在比在途内容更新的待写快照，本次无法保证已落盘 → 返回 false，
    // 让删除/切换等调用方中止；补盘由 run 的 finally 续写定时器负责。
    if (st.saveStatus === 'saving') {
      return !(pending && pending.docId === st.docId && pending.revision > st.lastSavedRevision);
    }
    return run();
  },

  retrySave: async () => {
    // 失败时 pending 已置空；从当前内存内容重建快照后再保存，使手动重试真正生效
    const st = get();
    if (!st.docId) return;
    if (st.revision > st.lastSavedRevision) {
      pending = { docId: st.docId, content: st.content, revision: st.revision };
    }
    await get().flushSave();
  },

  resetSaveState: () => {
    set({ saveStatus: 'idle', failCount: 0 });
  },
}));
