import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Document } from '../types/models';
import { AppError } from '../utils/errors';
import { useEditorStore } from '../stores/editor.store';
import { useDocumentsStore } from '../stores/documents.store';
import * as storageService from '../services/storage/storage.service';
import type { StorageService } from '../services/storage/storage.service';

const doc: Document = {
  id: 'doc-1',
  title: '测试文档',
  content: '初始内容',
  createdAt: 1000,
  updatedAt: 1000,
};

function makeService(update: ReturnType<typeof vi.fn>): StorageService {
  return {
    listDocuments: vi.fn(async () => [doc]),
    getDocument: vi.fn(async () => doc),
    createDocument: vi.fn(async (p) => ({ ...doc, ...p, id: doc.id })),
    updateDocument: update,
    deleteDocument: vi.fn(async () => {}),
    isFallbackMode: () => true,
  };
}

describe('editor.store retrySave（QA 回归：手动重试路径）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState({ docId: null, content: '', revision: 0, lastSavedRevision: 0, saveStatus: 'idle', failCount: 0 });
    useDocumentsStore.setState({ documents: [doc], activeDocId: doc.id, loaded: true, loading: false, fallbackMode: true, searchQuery: '', initError: null });
  });

  it('保存失败后 retrySave 从内存内容重建快照并成功保存', async () => {
    const update = vi.fn()
      .mockRejectedValueOnce(new AppError('SAVE_FAILED', '写入失败'))
      .mockResolvedValueOnce({ ...doc, content: '新内容', updatedAt: 2000 });
    const svc = makeService(update);
    vi.spyOn(storageService, 'getStorageService').mockResolvedValue(svc);

    useEditorStore.getState().loadDocument(doc);
    useEditorStore.getState().setContent('新内容'); // revision 1，pending 被调度

    // 立即触发保存 → 失败 → saveStatus=error，pending 置空
    await useEditorStore.getState().flushSave();
    expect(useEditorStore.getState().saveStatus).toBe('error');

    // retrySave 应重建 pending 并成功写入当前内存内容
    await useEditorStore.getState().retrySave();
    expect(useEditorStore.getState().saveStatus).toBe('saved');
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'doc-1', content: '新内容' }));
    expect(useEditorStore.getState().lastSavedRevision).toBe(1);
  });

  it('无待保存变更时 retrySave 为空操作（不抛错）', async () => {
    const update = vi.fn();
    const svc = makeService(update);
    vi.spyOn(storageService, 'getStorageService').mockResolvedValue(svc);

    useEditorStore.getState().loadDocument(doc);
    // revision === lastSavedRevision，无变更
    await useEditorStore.getState().retrySave();
    expect(update).not.toHaveBeenCalled();
  });
});
