import { memo, useLayoutEffect, useRef, useState, type RefObject } from 'react';

interface Props {
  content: string;
  cursorLine: number;
  /** 是否出现纵向滚动条（滚动条占位会导致换行点偏移，需在镜面层右侧补偿） */
  hasVScroll: boolean;
  /** textarea 当前 scrollTop（父组件驱动，镜面层同步滚动） */
  scrollTop: number;
  /** 打字机模式读取该元素 offsetTop 定位滚动（语义保持与旧版逐行 span 一致） */
  activeLineRef: RefObject<HTMLSpanElement | null>;
}

/** 高亮条（内容坐标）：top 相对镜面 pre 顶部（含 padding），随镜像层同步滚动 */
interface HighlightBar {
  top: number;
  height: number;
}

const PAD_X = 'var(--space-8)';
const PAD_Y = 'var(--space-6)';

/** 判等（0.5px 容差），避免亚像素抖动触发无谓重渲染 */
function sameBars(a: HighlightBar[], b: HighlightBar[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].top - b[i].top) > 0.5 || Math.abs(a[i].height - b[i].height) > 0.5) return false;
  }
  return true;
}

/**
 * 光标行高亮镜面层（PERF-03 重构：单文本节点镜像 + Range API 定位）：
 * - 镜像 <pre> 只含一个文本节点，内容变化用 textContent 命令式写入——绕开 React 对
 *   全文逐行 span 的 O(n) reconcile（旧实现每次击键 diff 全部行节点，万行文档每键 5ms+）。
 * - 高亮条为绝对定位 div，用 Range.getClientRects() 测量活动行的全部折行矩形
 *   （whitespace-pre-wrap 折行安全，每条矩形即一个视觉行），坐标换算为 pre 内内容坐标。
 * - 打字机模式兼容：activeLineRef 绑在第一条高亮条上，其 offsetTop = 活动行内容坐标
 *   （与旧版 span.offsetTop 参考点一致——均为 pre border 盒顶含 padding）。
 * - 边界：空行/末尾空行 Range 无矩形时借前一字符（换行符）的行盒兜底；仍无则不画
 *   （空文档场景，打字机模式对 null ref 已有守卫）。
 * - 文本透明（color: transparent），只露出背景；滚动与 textarea 同步（aria-hidden，不参与交互）。
 * - UIUX-V2 §5.1 / SM-14。
 */
function ActiveLineHighlightImpl({ content, cursorLine, hasVScroll, scrollTop, activeLineRef }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  /** 已写入镜像的文本（避免仅光标行变化时重写整篇文本节点） */
  const mirroredRef = useRef<string>('');
  const [bars, setBars] = useState<HighlightBar[]>([]);

  // ① 内容变化：先写文本节点，再测量（同一 effect 内保证顺序）；useLayoutEffect 避免首帧闪空
  useLayoutEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    if (mirroredRef.current !== content) {
      pre.textContent = content;
      mirroredRef.current = content;
    }

    if (content === '') {
      setBars((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // 定位活动行字符区间 [start, end)
    let off = 0;
    for (let i = 0; i < cursorLine; i++) {
      const nl = content.indexOf('\n', off);
      if (nl === -1) {
        off = content.length;
        break;
      }
      off = nl + 1;
    }
    const start = Math.min(off, content.length);
    const nlEnd = content.indexOf('\n', start);
    const end = nlEnd === -1 ? content.length : nlEnd + 1;

    const node = pre.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      setBars((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const text = node as Text;
    const len = text.length;

    const range = document.createRange();
    const measure = (s: number, e: number): DOMRect[] => {
      const cs = Math.min(Math.max(s, 0), len);
      const ce = Math.min(Math.max(e, cs + (cs < len ? 1 : 0)), len);
      range.setStart(text, cs);
      range.setEnd(text, ce);
      return Array.from(range.getClientRects());
    };

    let rects = measure(start, end);
    // 空行兜底：Range 无矩形（空行无字形）时借前一字符（换行符）的行盒
    if (rects.length === 0 && start > 0) rects = measure(start - 1, end);
    if (rects.length === 0) {
      setBars((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const preRect = pre.getBoundingClientRect();
    const next: HighlightBar[] = rects
      .filter((r) => r.height > 0)
      .map((r) => ({ top: r.top - preRect.top + pre.scrollTop, height: r.height }));
    setBars((prev) => (sameBars(prev, next) ? prev : next));
  }, [content, cursorLine]);

  // ② 滚动同步：镜像 pre 内部滚动，高亮层（绝对定位条所在滚动容器）同步 scrollTop
  useLayoutEffect(() => {
    if (preRef.current) preRef.current.scrollTop = scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  const padRight = hasVScroll ? `calc(${PAD_X} + 8px)` : PAD_X;

  return (
    <>
      {/* 镜像层：仅一个文本节点（textContent 命令式维护，React 永不渲染其子节点） */}
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden whitespace-pre-wrap break-words font-body tx-editor lh-editor text-transparent select-none"
        style={{ tabSize: 2, paddingLeft: PAD_X, paddingRight: padRight, paddingTop: PAD_Y, paddingBottom: PAD_Y }}
      />
      {/* 高亮层：与镜像同几何（inset-0），条坐标为内容坐标，随 scrollTop 同步滚动 */}
      <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {bars.map((bar, i) => (
          <div
            /* TextareaEditor 的 activeLineRef 声明为 HTMLSpanElement（该文件不在本轮白名单），
               此处元素实为 div，仅为打字机模式读取 offsetTop，运行时无类型差异，cast 对齐 */
            key={i}
            ref={i === 0 ? (activeLineRef as unknown as RefObject<HTMLDivElement | null>) : undefined}
            className="editor-active-line absolute"
            style={{ top: bar.top, height: bar.height, left: PAD_X, right: padRight }}
          />
        ))}
      </div>
    </>
  );
}

/** SM-14：浅比较 props，content 未变（或仅父级无关状态变化）时跳过重渲染 */
const ActiveLineHighlight = memo(ActiveLineHighlightImpl);
export default ActiveLineHighlight;
