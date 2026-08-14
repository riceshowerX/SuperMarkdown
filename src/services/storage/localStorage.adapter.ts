import type { Document } from '../../types/models';
import type { StorageAdapter } from './storage.adapter';
import { STORAGE_FALLBACK_KEY } from '../../config/constants';

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
      return Array.isArray(parsed) ? (parsed as Document[]) : [];
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
