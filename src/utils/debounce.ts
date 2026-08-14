/** 防抖纯工具（架构 utils/debounce.ts） */

export type Timer = ReturnType<typeof setTimeout>;

/** 标准防抖：delay 内重复调用重置计时器 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  let timer: Timer | null = null;
  const debounced = (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
