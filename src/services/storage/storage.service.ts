import type { Document } from '../../types/models';
import type { StorageAdapter } from './storage.adapter';
import { probeIndexedDB } from './storage.adapter';
import { DexieAdapter } from './dexie.adapter';
import { LocalStorageAdapter } from './localStorage.adapter';
import { db } from './db';
import { newId } from '../../utils/id';
import { AppError } from '../../utils/errors';

/** 存储服务接口（架构 §9.2 锁定） */
export interface StorageService {
  listDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(partial?: { title?: string; content?: string }): Promise<Document>;
  updateDocument(doc: { id: string; title?: string; content?: string }): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  isFallbackMode(): boolean;
}

export class StorageServiceImpl implements StorageService {
  private readonly adapter: StorageAdapter;
  private readonly fallback: boolean;

  constructor(adapter: StorageAdapter, fallback: boolean) {
    this.adapter = adapter;
    this.fallback = fallback;
  }

  async listDocuments(): Promise<Document[]> {
    try {
      return await this.adapter.listDocuments();
    } catch (err) {
      throw new AppError('LOAD_FAILED', '读取文档列表失败');
    }
  }

  async getDocument(id: string): Promise<Document | undefined> {
    try {
      return await this.adapter.getDocument(id);
    } catch {
      throw new AppError('LOAD_FAILED', '读取文档失败');
    }
  }

  async createDocument(partial: { title?: string; content?: string } = {}): Promise<Document> {
    const now = Date.now();
    const doc: Document = {
      id: newId(),
      title: partial.title ?? '无标题文档',
      content: partial.content ?? '',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.adapter.createDocument(doc);
      return doc;
    } catch (err) {
      if (isQuotaError(err)) throw new AppError('STORAGE_QUOTA_EXCEEDED', '存储空间已满，无法新建文档');
      throw new AppError('SAVE_FAILED', '新建文档失败');
    }
  }

  async updateDocument(doc: { id: string; title?: string; content?: string }): Promise<Document> {
    try {
      const existing = await this.adapter.getDocument(doc.id);
      const now = Date.now();
      const merged: Document = {
        id: doc.id,
        title: doc.title ?? existing?.title ?? '无标题文档',
        content: doc.content ?? existing?.content ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await this.adapter.updateDocument(merged);
      return merged;
    } catch (err) {
      if (isQuotaError(err)) throw new AppError('STORAGE_QUOTA_EXCEEDED', '存储空间已满，保存失败');
      throw new AppError('SAVE_FAILED', '保存失败，内容已保留在内存中');
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      await this.adapter.deleteDocument(id);
    } catch {
      throw new AppError('DELETE_FAILED', '删除文档失败');
    }
  }

  isFallbackMode(): boolean {
    return this.fallback;
  }
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof AppError) return err.code === 'STORAGE_QUOTA_EXCEEDED';
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'QuotaExceededException');
}

let singleton: StorageService | null = null;

/** 启动时选择适配器：IndexedDB 可用 → Dexie；否则 localStorage 兜底 */
export async function getStorageService(): Promise<StorageService> {
  if (singleton) return singleton;
  const idbOk = await probeIndexedDB();
  if (idbOk) {
    try {
      await db.open();
      singleton = new StorageServiceImpl(new DexieAdapter(), false);
      return singleton;
    } catch {
      /* 打开失败降级 */
    }
  }
  singleton = new StorageServiceImpl(new LocalStorageAdapter(), true);
  return singleton;
}

/** 仅供测试注入 */
export function resetStorageService(): void {
  singleton = null;
}
