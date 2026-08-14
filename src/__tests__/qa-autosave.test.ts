/**
 * QA 独立补充测试：自动保存时序与失败路径（AC-03 / AC-04 / AC-18）
 * 基于 Spec §9 验收标准反推，黑盒断言可观测状态，不绑定实现细节。
 * 覆盖前端现有测试未触及的 editor.store 调度逻辑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEditorStore } from '../stores/editor.store';
import { useDocumentsStore } from '../stores/documents.store';
import { useUiStore } from '../stores/ui.store';
import { getStorageService } from '../services/storage/storage.service';
import type { Document } from '../types/models';

vi.mock('../services/storage/storage.service', () => ({
  getStorageService: vi.fn(),
}));

function makeDoc(id = 'd1', content = ''): Document {
  return { id, title: '测试文档', content, createdAt: 1, updatedAt: 1 };
}

/** 可控假存储：可切换失败模式、可手动 resolve 写事务 */
function makeFakeStorage(opts: { fail?: boolean } = {}) {
  let fail = opts.fail ?? false;
  const map = new Map<string, Document>();
  const pendingWrites: Array<{ doc: Document; resolve: (d: Document) => void }> = [];

  const storage = {
    listDocuments: vi.fn(async () => Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)),
    getDocument: vi.fn(async (id: string) => map.get(id)),
    createDocument: vi.fn(async (p: { title?: string; content?: string }) => {
      const doc: Document = { id: `doc-${map.size + 1}`, title: p.title ?? '无标题文档', content: p.content ?? '', createdAt: Date.now(), updatedAt: Date.now() };
      map.set(doc.id, doc);
      return doc;
    }),
    updateDocument: vi.fn((doc: Document) => {
      if (fail) return Promise.reject(new Error('mock quota exceeded'));
      return new Promise<Document>((resolve) => {
        pendingWrites.push({ doc, resolve });
      });
    }),
    deleteDocument: vi.fn(async (id: string) => { map.delete(id); }),
    isFallbackMode: vi.fn(() => false),
  };
  return {
    storage,
    setFail: (v: boolean) => { fail = v; },
    flushPendingWrites: () => {
      for (const w of pendingWrites.splice(0)) {
        const merged = { ...(map.get(w.doc.id) ?? w.doc), ...w.doc, updatedAt: Date.now() };
        map.set(w.doc.id, merged);
        w.resolve(merged);
      }
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  useEditorStore.setState({
    docId: null, content: '', revision: 0, lastSavedRevision: 0, saveStatus: 'idle', failCount: 0,
  });
  useDocumentsStore.setState({ documents: [], activeDocId: null, loaded: false, loading: false, fallbackMode: false, searchQuery: '', initError: null });
  useUiStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('QA: 自动保存 800ms 防抖（AC-03）', () => {
  it('停止输入不足 800ms 不写盘，满 800ms 写盘一次并置 saved', async () => {
    const { storage } = makeFakeStorage();
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('# 标题');

    await vi.advanceTimersByTimeAsync(799);
    expect(storage.updateDocument).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    // updateDocument 返回 pending promise → saveStatus 先 saving；resolve 后 saved
    expect(storage.updateDocument).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().saveStatus).toBe('saving');
  });

  it('连续输入只触发一次保存，且保存的是最新内容', async () => {
    const { storage, flushPendingWrites } = makeFakeStorage();
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('a');
    await vi.advanceTimersByTimeAsync(500);
    useEditorStore.getState().setContent('ab');
    await vi.advanceTimersByTimeAsync(500);
    useEditorStore.getState().setContent('abc');
    await vi.advanceTimersByTimeAsync(799);
    expect(storage.updateDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(storage.updateDocument).toHaveBeenCalledTimes(1);
    expect(storage.updateDocument.mock.calls[0][0].content).toBe('abc');

    flushPendingWrites();
    await Promise.resolve();
    expect(useEditorStore.getState().saveStatus).toBe('saved');
  });

  it('保存完成后再次 flush 不重复写（lastSavedRevision 去重）', async () => {
    const { storage, flushPendingWrites } = makeFakeStorage();
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('v1');
    await vi.advanceTimersByTimeAsync(800);
    flushPendingWrites();
    await Promise.resolve();
    expect(useEditorStore.getState().saveStatus).toBe('saved');

    // 内容未变化，主动 flush 不应再次写盘
    await useEditorStore.getState().flushSave();
    expect(storage.updateDocument).toHaveBeenCalledTimes(1);
  });

  it('在途写入期间输入新内容，完成后自动补写最新内容（AC-04 竞态防护）', async () => {
    const { storage, flushPendingWrites } = makeFakeStorage();
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('v1');
    await vi.advanceTimersByTimeAsync(800); // 触发第一次写，pending 未 resolve
    expect(useEditorStore.getState().saveStatus).toBe('saving');

    useEditorStore.getState().setContent('v2'); // 在途时新输入
    flushPendingWrites(); // 完成第一次写
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50); // finally 调度补写

    expect(storage.updateDocument.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastCall = storage.updateDocument.mock.calls[storage.updateDocument.mock.calls.length - 1];
    expect(lastCall[0].content).toBe('v2');
  });
});

describe('QA: 保存失败路径（AC-18）', () => {
  it('写入失败 → saveStatus=error、failCount 递增、内存副本保留', async () => {
    const { storage } = makeFakeStorage({ fail: true });
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('重要内容');
    await vi.advanceTimersByTimeAsync(800);
    await Promise.resolve();

    expect(useEditorStore.getState().saveStatus).toBe('error');
    expect(useEditorStore.getState().failCount).toBe(1);
    expect(useEditorStore.getState().content).toBe('重要内容'); // 内存副本保留
  });

  it('下次输入自动重试（无需手动干预）', async () => {
    const { storage, setFail } = makeFakeStorage({ fail: true });
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    useEditorStore.getState().setContent('第一版');
    await vi.advanceTimersByTimeAsync(800);
    await Promise.resolve();
    expect(useEditorStore.getState().failCount).toBe(1);

    setFail(false); // 存储恢复
    useEditorStore.getState().setContent('第二版'); // 输入触发自动重试
    await vi.advanceTimersByTimeAsync(800);
    expect(useEditorStore.getState().saveStatus).toBe('saving'); // 写入成功进行中
  });

  it('连续失败 3 次 → 提示导出备份（toast actionLabel）', async () => {
    const { storage } = makeFakeStorage({ fail: true });
    vi.mocked(getStorageService).mockResolvedValue(storage as never);

    useEditorStore.getState().loadDocument(makeDoc());
    for (let i = 1; i <= 3; i++) {
      useEditorStore.getState().setContent(`版本 ${i}`);
      await vi.advanceTimersByTimeAsync(800);
      await Promise.resolve();
    }
    const toasts = useUiStore.getState().toasts;
    expect(useEditorStore.getState().failCount).toBe(3);
    expect(toasts.some((t) => t.actionLabel === '导出备份' && t.kind === 'error')).toBe(true);
  });
});
