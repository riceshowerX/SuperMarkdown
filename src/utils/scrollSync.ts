/** 滚动同步纯函数（UIUX-V2 §5.3；分屏 150ms 锚点映射，失败静默降级） */

/** 滚动比例（0..1）；无可滚动空间返回 0（避免除零/NaN） */
export function clampScrollRatio(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 0;
  const ratio = scrollTop / max;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

/** 由比例换算目标 scrollTop（取整，防止亚像素抖动） */
export function scrollTopFromRatio(ratio: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, ratio)) * max);
}
