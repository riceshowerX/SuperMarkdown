import type { Document } from '../../types/models';

/** 存储适配器接口（架构 §7.3） */
export interface StorageAdapter {
  listDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: Document): Promise<void>;
  updateDocument(doc: Document): Promise<void>;
  deleteDocument(id: string): Promise<void>;
}

/**
 * 运行时探测 IndexedDB 可用性（隐私模式/旧内核返回 false）
 * SM-12 加固：
 * - onblocked → 判定不可用（升级被其他连接阻塞时 open 可能永久挂起）
 * - 1s 超时兜底 → 任何未知挂起场景都不阻塞启动流程
 * - 探测库首次创建（oldVersion === 0）为正常路径；对既有库的意外升级属环境异常，中止升级
 */
export function probeIndexedDB(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), 1000);
    try {
      if (typeof indexedDB === 'undefined') {
        done(false);
        return;
      }
      const req = indexedDB.open('sm-probe-db', 1);
      req.onblocked = () => done(false);
      req.onupgradeneeded = (ev) => {
        // 仅对既有探测库的升级视为异常（正常首次创建 oldVersion === 0）
        // oldVersion 在 IDBVersionChangeEvent 上（而非 request 上）
        if (ev.oldVersion > 0) {
          try {
            req.transaction?.abort();
          } catch {
            /* 忽略 */
          }
        }
      };
      req.onerror = () => done(false);
      req.onsuccess = () => {
        try {
          req.result.close();
          const del = indexedDB.deleteDatabase('sm-probe-db');
          // 清理失败不影响判定（探测已成功）
          del.onblocked = () => {
            try {
              del.result;
            } catch {
              /* 忽略 */
            }
          };
        } catch {
          /* 忽略清理失败 */
        }
        done(true);
      };
    } catch {
      done(false);
    }
  });
}
