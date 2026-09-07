/** 文档 id 生成（架构 utils/id.ts） */

/** crypto.randomUUID()；不可用时回退 crypto.getRandomValues（CSPRNG，SM-63），
 *  仅两者都缺失（极老内核）才退回时间戳+Math.random */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      // 构造 UUID v4 形态（随机 128bit + 版本/变体位），熵与 randomUUID 等价
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // variant 10
      const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    /* 降级 */
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `doc-${Date.now().toString(36)}-${rand}`;
}
