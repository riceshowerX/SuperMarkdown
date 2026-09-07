import type { Document } from '../../types/models';
import type { StorageAdapter } from './storage.adapter';
import { probeIndexedDB } from './storage.adapter';
import { DexieAdapter } from './dexie.adapter';
import { LocalStorageAdapter } from './localStorage.adapter';
import { db } from './db';
import { newId } from '../../utils/id';
import { AppError } from '../../utils/errors';
import { isCrashBufferPayload, type CrashBufferPayload } from '../../types/guards';
import { CRASH_BUFFER_KEY } from '../../config/constants';

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
      if (!existing) {
        // SM-02：删除语义优先——目标已不存在时拒绝写入，
        // 避免在途保存把"已删除"的文档复活成空壳
        throw new AppError('SAVE_FAILED', '文档不存在或已被删除');
      }
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
      // 业务异常（含上方主动抛出）原样上抛，避免被降级文案吞掉
      if (err instanceof AppError) throw err;
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

/** 跨浏览器配额错误识别（SM-62：Chrome/旧 IE/旧 WebKit 的 name 与 code 各不相同） */
function isQuotaError(err: unknown): boolean {
  if (err instanceof AppError) return err.code === 'STORAGE_QUOTA_EXCEEDED';
  if (!(err instanceof Error)) return false;
  const e = err as DOMException;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'QuotaExceededException' ||
    e.name === 'QUOTA_EXCEEDED_ERR' ||
    e.code === 22 || // DOMException.QUOTA_EXCEEDED_ERR（Chrome / 旧 WebKit）
    e.code === 1014  // Firefox NS_ERROR_DOM_QUOTA_REACHED
  );
}

/* ── SM-09：关窗兜底缓冲（localStorage 同步写入，对抗 beforeunload 中异步 IndexedDB 被中止） ── */

/** 同步写入关窗兜底缓冲；失败静默（缓冲是尽力而为的最后防线，不阻塞关闭流程） */
export function writeCrashBuffer(payload: CrashBufferPayload): void {
  try {
    localStorage.setItem(CRASH_BUFFER_KEY, JSON.stringify(payload));
  } catch {
    /* 忽略 */
  }
}

/** 读取兜底缓冲；载荷非法（脏数据/结构不符）时返回 null，不直接清键（留待调用方决策） */
export function readCrashBuffer(): CrashBufferPayload | null {
  try {
    const raw = localStorage.getItem(CRASH_BUFFER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCrashBufferPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 清除指定文档的兜底缓冲（正式保存成功后调用；docId 不匹配则保留） */
export function clearCrashBuffer(docId: string): void {
  try {
    const buffer = readCrashBuffer();
    if (buffer && buffer.docId === docId) {
      localStorage.removeItem(CRASH_BUFFER_KEY);
    }
  } catch {
    /* 忽略 */
  }
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
