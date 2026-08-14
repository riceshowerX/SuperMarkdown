import { describe, it, expect, beforeEach } from 'vitest';
import { StorageServiceImpl, resetStorageService } from '../services/storage/storage.service';
import { LocalStorageAdapter } from '../services/storage/localStorage.adapter';
import { STORAGE_FALLBACK_KEY } from '../config/constants';

function makeService() {
  return new StorageServiceImpl(new LocalStorageAdapter(), true);
}

describe('storage.service (LocalStorageAdapter)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  it('create → list → get 完整链路', async () => {
    const svc = makeService();
    const doc = await svc.createDocument({ title: '第一篇', content: '# 你好' });
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe('第一篇');
    expect(doc.createdAt).toBe(doc.updatedAt);

    const list = await svc.listDocuments();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(doc.id);

    const fetched = await svc.getDocument(doc.id);
    expect(fetched?.content).toBe('# 你好');
  });

  it('listDocuments 按 updatedAt 降序', async () => {
    const svc = makeService();
    const a = await svc.createDocument({ title: 'A' });
    const b = await svc.createDocument({ title: 'B' });
    // 更新 A 使其最新
    await new Promise((r) => setTimeout(r, 5));
    await svc.updateDocument({ id: a.id, content: '# 更新' });
    const list = await svc.listDocuments();
    expect(list[0].id).toBe(a.id);
    expect(list[1].id).toBe(b.id);
  });

  it('updateDocument 合并字段且保留 createdAt', async () => {
    const svc = makeService();
    const doc = await svc.createDocument({ title: '原名', content: '旧内容' });
    const updated = await svc.updateDocument({ id: doc.id, content: '新内容' });
    expect(updated.title).toBe('原名');
    expect(updated.content).toBe('新内容');
    expect(updated.createdAt).toBe(doc.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(doc.updatedAt);
  });

  it('deleteDocument 移除文档', async () => {
    const svc = makeService();
    const doc = await svc.createDocument({ title: '待删' });
    await svc.deleteDocument(doc.id);
    expect(await svc.listDocuments()).toHaveLength(0);
    expect(await svc.getDocument(doc.id)).toBeUndefined();
  });

  it('localStorage 兜底键持久化', async () => {
    const svc = makeService();
    await svc.createDocument({ title: '持久' });
    const raw = localStorage.getItem(STORAGE_FALLBACK_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('持久');
  });
});
