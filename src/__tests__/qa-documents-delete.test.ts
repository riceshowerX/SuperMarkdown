/**
 * QA 独立补充测试：多文档删除切换与空列表自动新建（AC-08）
 * 基于 Spec §9 验收标准反推，黑盒断言可观测状态。
 * 覆盖前端现有测试未触及的 documents.store.deleteDocument 相邻切换逻辑。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocumentsStore } from '../stores/documents.store';
import { useEditorStore } from '../stores/editor.store';
import { getStorageService } from '../services/storage/storage.service';
import { LocalStorageAdapter } from '../services/storage/localStorage.adapter';
import type { Document } from '../types/models';

vi.mock('../services/storage/storage.service', () => ({
  getStorageService: vi.fn(),
}));

function makeAdapter() {
  return new LocalStorageAdapter();
}

function makeService() {
  const adapter = makeAdapter();
  return {
    listDocuments: () => adapter.listDocuments(),
    getDocument: (id: string) => adapter.getDocument(id),
    // 对齐 StorageService 契约：createDocument/updateDocument 必须返回 Document（adapter 返回 void）
    createDocument: async (p?: { title?: string; content?: string }) => {
      const doc: Document = {
        id: `d-${Date.now()}-${Math.random()}`,
        title: p?.title ?? '无标题文档',
        content: p?.content ?? '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await adapter.createDocument(doc);
      return doc;
    },
    updateDocument: async (doc: { id: string; title?: string; content?: string }) => {
      const existing = await adapter.getDocument(doc.id);
      const merged: Document = {
        id: doc.id,
        title: doc.title ?? existing?.title ?? '无标题文档',
        content: doc.content ?? existing?.content ?? '',
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await adapter.updateDocument(merged);
      return merged;
    },
    deleteDocument: (id: string) => adapter.deleteDocument(id),
    isFallbackMode: () => false,
  };
}

function seed(docs: Document[]) {
  const adapter = makeAdapter();
  for (const d of docs) void adapter.createDocument(d);
  return { adapter, service: makeService() };
}

beforeEach(() => {
  localStorage.clear();
  useDocumentsStore.setState({ documents: [], activeDocId: null, loaded: false, loading: false, fallbackMode: false, searchQuery: '', initError: null });
  useEditorStore.setState({ docId: null, content: '', revision: 0, lastSavedRevision: 0, saveStatus: 'idle', failCount: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('QA: 删除文档后切换相邻文档（AC-08）', () => {
  it('删除中间文档 → 切换到后一个文档', async () => {
    const { service } = seed([
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
      { id: 'c', title: 'C', content: '', createdAt: 1, updatedAt: 1 },
    ]);
    vi.mocked(getStorageService).mockResolvedValue(service as never);
    useDocumentsStore.setState({ documents: [
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
      { id: 'c', title: 'C', content: '', createdAt: 1, updatedAt: 1 },
    ], activeDocId: 'a' });

    await useDocumentsStore.getState().deleteDocument('a');
    // 原位置是首位，切换到相邻（原 idx=0 → remaining[0]='b'）
    expect(useDocumentsStore.getState().activeDocId).toBe('b');
    expect(useDocumentsStore.getState().documents.map((d) => d.id)).not.toContain('a');
  });

  it('删除最后一个文档 → 切换到前一个（相邻）', async () => {
    const { service } = seed([
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
    ]);
    vi.mocked(getStorageService).mockResolvedValue(service as never);
    useDocumentsStore.setState({ documents: [
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
    ], activeDocId: 'b' });

    await useDocumentsStore.getState().deleteDocument('b');
    expect(useDocumentsStore.getState().activeDocId).toBe('a');
  });

  it('删除唯一文档 → 自动新建「无标题文档 1」并进入编辑态（AC-08 空列表）', async () => {
    const { service } = seed([{ id: 'only', title: '唯一', content: '', createdAt: 1, updatedAt: 1 }]);
    vi.mocked(getStorageService).mockResolvedValue(service as never);
    useDocumentsStore.setState({ documents: [{ id: 'only', title: '唯一', content: '', createdAt: 1, updatedAt: 1 }], activeDocId: 'only' });

    await useDocumentsStore.getState().deleteDocument('only');
    const st = useDocumentsStore.getState();
    expect(st.documents).toHaveLength(1);
    expect(st.documents[0].title).toContain('无标题文档');
    expect(st.activeDocId).toBe(st.documents[0].id);
  });

  it('删除非当前文档 → 当前激活文档不变', async () => {
    const { service } = seed([
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
    ]);
    vi.mocked(getStorageService).mockResolvedValue(service as never);
    useDocumentsStore.setState({ documents: [
      { id: 'a', title: 'A', content: '', createdAt: 3, updatedAt: 3 },
      { id: 'b', title: 'B', content: '', createdAt: 2, updatedAt: 2 },
    ], activeDocId: 'a' });

    await useDocumentsStore.getState().deleteDocument('b');
    expect(useDocumentsStore.getState().activeDocId).toBe('a');
    expect(useDocumentsStore.getState().documents).toHaveLength(1);
  });
});

describe('QA: 刷新后按最近修改降序恢复（AC-09）', () => {
  it('listDocuments 按 updatedAt 降序，新实例可完整读回（模拟刷新）', async () => {
    const adapter = makeAdapter();
    const now = 1000;
    const docs: Document[] = [
      { id: 'old', title: '旧', content: 'old-content', createdAt: now, updatedAt: now },
      { id: 'new', title: '新', content: 'new-content', createdAt: now + 100, updatedAt: now + 100 },
    ];
    for (const d of docs) await adapter.createDocument(d);

    // 新实例（模拟页面刷新后重新构造）
    const fresh = new LocalStorageAdapter();
    const list = await fresh.listDocuments();
    expect(list.map((d) => d.id)).toEqual(['new', 'old']); // 最近修改在前
    expect(list[0].content).toBe('new-content');
    expect(list[1].content).toBe('old-content');
  });
});
