/** 运行时类型守卫（SM-20）：外部反序列化数据（localStorage / IndexedDB）进入内存前的字段级校验 */

import type { Document } from './models';

/**
 * 校验任意未知结构是否为合法 Document。
 * 所有键必须是期望类型（而非仅"存在"），多余/缺失/脏键（含 __proto__ 自有属性）
 * 一律拒绝——调用方应整体丢弃该条目，而非部分合并。
 */
export function isDocument(v: unknown): v is Document {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    d.id.length > 0 &&
    d.id.length <= 128 &&
    typeof d.title === 'string' &&
    typeof d.content === 'string' &&
    typeof d.createdAt === 'number' &&
    Number.isFinite(d.createdAt) &&
    typeof d.updatedAt === 'number' &&
    Number.isFinite(d.updatedAt)
  );
}

/** 关窗兜底缓冲载荷（SM-09），由 useAutoSave 写入 / documents.store.initialize 读取 */
export interface CrashBufferPayload {
  /** 归属文档 id：恢复时必须与目标文档匹配，杜绝跨文档内容覆盖 */
  docId: string;
  content: string;
  revision: number;
  /** 写入时刻 epoch ms，用于与文档 updatedAt 比较新旧 */
  ts: number;
}

/** 校验崩溃缓冲载荷（写入方是我们自己，但仍按不可信输入对待） */
export function isCrashBufferPayload(v: unknown): v is CrashBufferPayload {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.docId === 'string' &&
    b.docId.length > 0 &&
    b.docId.length <= 128 &&
    typeof b.content === 'string' &&
    typeof b.revision === 'number' &&
    Number.isFinite(b.revision) &&
    typeof b.ts === 'number' &&
    Number.isFinite(b.ts)
  );
}
