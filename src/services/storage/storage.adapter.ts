import type { Document } from '../../types/models';

/** 存储适配器接口（架构 §7.3） */
export interface StorageAdapter {
  listDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: Document): Promise<void>;
  updateDocument(doc: Document): Promise<void>;
  deleteDocument(id: string): Promise<void>;
}

/** 运行时探测 IndexedDB 可用性（隐私模式/旧内核返回 false） */
export function probeIndexedDB(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(false);
        return;
      }
      const req = indexedDB.open('sm-probe-db', 1);
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        try {
          req.result.close();
          indexedDB.deleteDatabase('sm-probe-db');
        } catch {
          /* 忽略清理失败 */
        }
        resolve(true);
      };
    } catch {
      resolve(false);
    }
  });
}
