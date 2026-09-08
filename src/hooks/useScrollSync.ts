/**
 * 编辑↔预览滚动同步（UIUX-V2 §5.3）：双向按比例映射，150ms 防抖，失败静默降级。
 * PERF-06 回声防护（替代旧「1 帧锁」，锁释放早于对侧 150ms 防抖，存在回声链）：
 * ① 写入死区：事件位置 ≈ 上次程序化写入值（±2px）→ 判为写入引发的回声，忽略；
 * ② 最近主动方 + 静默窗（250ms > 对侧 150ms 防抖）：静默窗内被动方事件不作数；
 * ③ 死区：目标已在位（±2px）不重复写入，防 ±1px 抖动互搏；
 * 用户真实滚动（偏离写入值）可随时刷新 lastActive，不被吞。
 */

import { useEffect, useRef } from 'react';
import { debounce } from '../utils/debounce';
import { clampScrollRatio, scrollTopFromRatio } from '../utils/scrollSync';

type ScrollRole = 'editor' | 'preview';

/** 分屏模式下编辑/预览的滚动容器注册表（SplitPane 装配时由两侧注册） */
const registry: Record<ScrollRole, HTMLElement | null> = { editor: null, preview: null };

/** 回声防护参数：静默窗覆盖对侧 150ms 防抖 + 余量；死区过滤 ±1px 取整抖动 */
const SILENCE_MS = 250;
const DEAD_ZONE_PX = 2;

/** 最近主动滚动方 + 静默窗截止时间（performance.now 时钟） */
let lastActive: ScrollRole | null = null;
let silenceUntil = 0;

/** 程序化写入的 scrollTop（按接收方记录）；NaN 表示无在途写入 */
const writtenScroll: Record<ScrollRole, number> = { editor: Number.NaN, preview: Number.NaN };

/** 把 from 侧的滚动比例同步到对侧；含回声识别与死区 */
function applySync(from: ScrollRole): void {
  const source = registry[from];
  const targetRole: ScrollRole = from === 'editor' ? 'preview' : 'editor';
  const target = registry[targetRole];
  if (!source || !target) return;
  try {
    const now = performance.now();
    // ① 写入回声：本次事件位置与上次写入值一致（±死区）→ 是程序化写入引发的滚动，忽略
    if (
      !Number.isNaN(writtenScroll[from]) &&
      Math.abs(source.scrollTop - writtenScroll[from]) < DEAD_ZONE_PX
    ) {
      return;
    }
    // ② 静默窗兜底：另一侧刚触发过同步，被动方此刻的滚动视为回声
    if (lastActive !== null && lastActive !== from && now < silenceUntil) return;

    const ratio = clampScrollRatio(source.scrollTop, source.scrollHeight, source.clientHeight);
    const next = scrollTopFromRatio(ratio, target.scrollHeight, target.clientHeight);
    // ③ 死区：目标已在位则不写（防 ±1px 抖动互搏）
    if (Math.abs(target.scrollTop - next) < DEAD_ZONE_PX) return;

    lastActive = from;
    silenceUntil = now + SILENCE_MS;
    writtenScroll[targetRole] = next;
    target.scrollTop = next;
  } catch {
    /* 静默降级：任一容器异常时放弃本次同步 */
  }
}

/** 防抖实例提升到模块级（SM-30/69）：tearDown 可跨 wire() 调用统一 cancel，
 *  避免旧实例的 pending 定时器在容器已解绑后仍触发 */
const syncToPreview = debounce(() => {
  if (!registry.editor || !registry.preview) return;
  applySync('editor');
}, 150);

const syncToEditor = debounce(() => {
  if (!registry.editor || !registry.preview) return;
  applySync('preview');
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
