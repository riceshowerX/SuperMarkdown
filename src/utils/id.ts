/** 文档 id 生成（架构 utils/id.ts） */

/** crypto.randomUUID()，不可用时回退到时间戳+随机数（仍满足唯一性） */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* 降级 */
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `doc-${Date.now().toString(36)}-${rand}`;
}
