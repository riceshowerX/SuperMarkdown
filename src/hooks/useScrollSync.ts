/** 编辑↔预览滚动同步（UIUX-V2 §5.3）：双向按比例映射，150ms 防抖，锁防回环，失败静默降级 */

import { useEffect, useRef } from 'react';
import { debounce } from '../utils/debounce';
import { clampScrollRatio, scrollTopFromRatio } from '../utils/scrollSync';

type ScrollRole = 'editor' | 'preview';

/** 分屏模式下编辑/预览的滚动容器注册表（SplitPane 装配时由两侧注册） */
const registry: Record<ScrollRole, HTMLElement | null> = { editor: null, preview: null };

function applySync(source: HTMLElement, target: HTMLElement): void {
  try {
    const ratio = clampScrollRatio(source.scrollTop, source.scrollHeight, source.clientHeight);
    target.scrollTop = scrollTopFromRatio(ratio, target.scrollHeight, target.clientHeight);
  } catch {
    /* 静默降级：任一容器异常时放弃本次同步 */
  }
}

let lock = false;

/** 防抖实例提升到模块级（SM-30/69）：tearDown 可跨 wire() 调用统一 cancel，
 *  避免旧实例的 pending 定时器在容器已解绑后仍触发 */
const syncToPreview = debounce(() => {
  if (lock || !registry.editor || !registry.preview) return;
  lock = true;
  applySync(registry.editor, registry.preview);
  requestAnimationFrame(() => {
    lock = false;
  });
}, 150);

const syncToEditor = debounce(() => {
  if (lock || !registry.editor || !registry.preview) return;
  lock = true;
  applySync(registry.preview, registry.editor);
  requestAnimationFrame(() => {
    lock = false;
  });
}, 150);

/** 已挂载的监听（成对保存 el + fn，SM-30/69：tearDown 按此移除，不从 registry 现值反查） */
const wiredListeners: Array<{ el: HTMLElement; fn: () => void }> = [];

function tearDown(): void {
  // 取消在途防抖，防止卸载/重绑后在旧容器上触发同步
  syncToPreview.cancel();
  syncToEditor.cancel();
  for (const { el, fn } of wiredListeners) {
    el.removeEventListener('scroll', fn);
  }
  wiredListeners.length = 0;
}

/** 双向绑定；两侧容器齐备才生效（分屏视图），任一缺失自动解除 */
function wire(): void {
  tearDown();
  const ed = registry.editor;
  const pv = registry.preview;
  if (!ed || !pv) return;

  const onEditorScroll = () => syncToPreview();
  const onPreviewScroll = () => syncToEditor();

  ed.addEventListener('scroll', onEditorScroll, { passive: true });
  pv.addEventListener('scroll', onPreviewScroll, { passive: true });
  wiredListeners.push({ el: ed, fn: onEditorScroll }, { el: pv, fn: onPreviewScroll });
}

/** 注册/注销某侧的滚动容器；返回注销函数 */
export function registerScrollRole(role: ScrollRole, el: HTMLElement | null): () => void {
  registry[role] = el;
  wire();
  return () => {
    if (registry[role] === el) registry[role] = null;
    wire();
  };
}

/** 组件内使用：挂载时注册滚动容器，卸载自动解除 */
export function useScrollRole(role: ScrollRole, ref: React.RefObject<HTMLElement | null>): void {
  const roleRef = useRef(role);
  roleRef.current = role;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerScrollRole(roleRef.current, el);
  }, [ref]);
}
