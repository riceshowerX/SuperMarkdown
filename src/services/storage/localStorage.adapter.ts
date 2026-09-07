import type { Document } from '../../types/models';
import type { StorageAdapter } from './storage.adapter';
import { STORAGE_FALLBACK_KEY, STORAGE_CORRUPT_PREFIX } from '../../config/constants';
import { isDocument } from '../../types/guards';

/**
 * localStorage 兜底适配器（架构 §7.3）
 * 单键 JSON 全量存储，仅 IndexedDB 不可用时的临时兜底。
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly key: string;

  constructor(key: string = STORAGE_FALLBACK_KEY) {
    this.key = key;
  }

  private readAll(): Document[] {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // SM-20：字段级校验，整体丢弃脏条目（而非部分合并，防止脏键进入内存对象）
      const valid = parsed.filter(isDocument);
      if (valid.length !== parsed.length) {
        // 丢弃前先把原始 JSON 留底，便于人工恢复（备份失败不阻塞读取）
        try {
          localStorage.setItem(`${STORAGE_CORRUPT_PREFIX}${Date.now()}`, raw);
        } catch {
          /* 备份失败忽略 */
        }
      }
      return valid;
    } catch {
      return [];
    }
  }

  private writeAll(docs: Document[]): void {
    localStorage.setItem(this.key, JSON.stringify(docs));
  }

  async listDocuments(): Promise<Document[]> {
    return this.readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.readAll().find((d) => d.id === id);
  }

  async createDocument(doc: Document): Promise<void> {
    const all = this.readAll();
    if (all.some((d) => d.id === doc.id)) return;
    all.push(doc);
    this.writeAll(all);
  }

  async updateDocument(doc: Document): Promise<void> {
    const all = this.readAll();
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx === -1) {
      all.push(doc);
    } else {
      all[idx] = { ...all[idx], ...doc };
    }
    this.writeAll(all);
  }

  async deleteDocument(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((d) => d.id !== id));
  }
}
