import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useScrollRole } from '../../hooks/useScrollSync';
import { useMermaidRender } from '../../hooks/useMermaidRender';
import type { RenderResult } from '../../types/models';
import { RENDER_DEBOUNCE_MS } from '../../config/constants';
import PreviewErrorBoundary from './PreviewErrorBoundary';

/** 渲染结果初始占位：渲染链按需加载完成前预览区为空（首帧闪烁可接受，见 PERF-05） */
const EMPTY_RESULT: RenderResult = { html: '', headings: [], error: null };

/** PERF-05：自适应防抖边界（按上次解析耗时的 2 倍动态调整，100ms 粒度防抖动） */
const MIN_RENDER_DEBOUNCE_MS = 300;
const MAX_RENDER_DEBOUNCE_MS = 1200;
const DELAY_STEP_MS = 100;

/**
 * 预览区（UIUX-V2 §5.3）：
 * - PERF-01：renderMarkdown 链（markdown-it/KaTeX/hljs/DOMPurify）按需动态加载，不进首屏 chunk
 * - PERF-05：防抖时长自适应（短文 300ms，长文按解析耗时放大至 1200ms），渲染不再固定挤压输入帧
 * - sanitize 后注入 + Mermaid 客户端渲染 + 错误边界 + 滚动同步注册
 */
export default function PreviewPane() {
  const content = useEditorStore((s) => s.content);
  const docId = useEditorStore((s) => s.docId);
  const theme = useUiStore((s) => s.theme);

  const [renderDelay, setRenderDelay] = useState(RENDER_DEBOUNCE_MS);
  const debounced = useDebouncedValue(content, renderDelay);
  const [result, setResult] = useState<RenderResult>(EMPTY_RESULT);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // 异步渲染：动态 import 解析链后执行；alive 标志丢弃过期结果（快速输入/卸载）
  useEffect(() => {
    let alive = true;
    void import('../../services/markdown/markdown.service')
      .then(({ renderMarkdown }) => {
        if (!alive) return;
        // 只计时纯解析耗时（不含模块加载），作为自适应防抖依据
        const t0 = performance.now();
        const next = renderMarkdown(debounced);
        const elapsed = performance.now() - t0;
        const nextDelay =
          Math.round(
            Math.min(MAX_RENDER_DEBOUNCE_MS, Math.max(MIN_RENDER_DEBOUNCE_MS, elapsed * 2)) /
              DELAY_STEP_MS,
          ) * DELAY_STEP_MS;
        setRenderDelay((prev) => (prev === nextDelay ? prev : nextDelay));
        setResult(next);
      })
      .catch(() => {
        // chunk 加载失败（极端：弱网首帧）降级为错误占位，不白屏
        if (alive) {
          setResult({ html: '<p class="render-error">渲染引擎加载失败</p>', headings: [], error: 'chunk load failed' });
        }
      });
    return () => {
      alive = false;
    };
  }, [debounced]);

  useMermaidRender(containerRef, result.html, theme);
  useScrollRole('preview', sectionRef);

  return (
    <section ref={sectionRef} className="sm-scroll flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface" aria-label="预览区">
      {docId && content.trim() === '' ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="tx-sm text-fg-2">预览将在此显示</p>
        </div>
      ) : (
        <PreviewErrorBoundary key={docId ?? 'none'}>
          {/* data-doc-id：供导出流程（app/actions.ts SM-74）校验 DOM 快照归属的文档 */}
          <div ref={containerRef} className="markdown-body" data-doc-id={docId ?? undefined} dangerouslySetInnerHTML={{ __html: result.html }} />
        </PreviewErrorBoundary>
      )}
    </section>
  );
}
