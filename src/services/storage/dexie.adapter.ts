import type { Document } from '../../types/models';
import type { StorageAdapter } from './storage.adapter';
import { db } from './db';

/** IndexedDB（Dexie）适配器 —— 默认主存储 */
export class DexieAdapter implements StorageAdapter {
  async listDocuments(): Promise<Document[]> {
    return db.documents.orderBy('updatedAt').reverse().toArray();
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return db.documents.get(id);
  }

  async createDocument(doc: Document): Promise<void> {
    await db.documents.add(doc);
  }

  async updateDocument(doc: Document): Promise<void> {
    await db.documents.put(doc);
  }

  async deleteDocument(id: string): Promise<void> {
    await db.documents.delete(id);
  }
}
