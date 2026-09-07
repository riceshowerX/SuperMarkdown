import { memo, useEffect, useMemo, useRef, type RefObject } from 'react';

interface Props {
  content: string;
  cursorLine: number;
  /** 是否出现纵向滚动条（滚动条占位会导致换行点偏移，需在镜面层右侧补偿） */
  hasVScroll: boolean;
  /** textarea 当前 scrollTop（父组件驱动，镜面层同步滚动） */
  scrollTop: number;
  activeLineRef: RefObject<HTMLSpanElement | null>;
}

/**
 * 光标行高亮镜面层：与 textarea 同字体/同内边距渲染全部文本，仅当前行带极淡底色。
 * 文本透明（color: transparent），只露出背景；滚动与 textarea 同步（aria-hidden，不参与交互）。
 * UIUX-V2 §5.1 光标行高亮（textarea 可实现，不改内核）。
 *
 * SM-14：memo 化——父组件（拖拽分栏/主题切换等）重渲染时本组件跳过 reconcile，
 * 避免大文档下每帧重建全部行 span。
 * 注：未做「可视窗口 ±20 行 + padding 撑高」的窗口化——textarea 为 whitespace-pre-wrap，
 * 长行会折行，固定行高 padding 会与 textarea 实际折行错位；窗口化需引入逐行像素测量，
 * 留待后续迭代（见审查报告 PERF-01）。
 */
function ActiveLineHighlightImpl({ content, cursorLine, hasVScroll, scrollTop, activeLineRef }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  const lines = useMemo(() => content.split('\n'), [content]);
  const padX = 'var(--space-8)';
  const padRight = hasVScroll ? `calc(${padX} + 8px)` : padX;

  return (
    <pre
      ref={preRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden whitespace-pre-wrap break-words font-body tx-editor lh-editor text-transparent select-none"
      style={{ tabSize: 2, paddingLeft: padX, paddingRight: padRight, paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}
    >
      {lines.map((line, i) => (
        <span key={i} ref={i === cursorLine ? activeLineRef : undefined} className={i === cursorLine ? 'editor-active-line' : undefined}>
          {line}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

/** SM-14：浅比较 props，content 未变（或仅父级无关状态变化）时跳过重渲染 */
const ActiveLineHighlight = memo(ActiveLineHighlightImpl);
export default ActiveLineHighlight;
