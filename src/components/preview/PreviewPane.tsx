import { useMemo, useRef } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useScrollRole } from '../../hooks/useScrollSync';
import { renderMarkdown } from '../../services/markdown/markdown.service';
import { RENDER_DEBOUNCE_MS } from '../../config/constants';
import PreviewErrorBoundary from './PreviewErrorBoundary';

/** 预览区（UIUX-V2 §5.3）：300ms 防抖渲染 + sanitize 后注入 + 错误边界 + 滚动同步注册 */
export default function PreviewPane() {
  const content = useEditorStore((s) => s.content);
  const docId = useEditorStore((s) => s.docId);
  const debounced = useDebouncedValue(content, RENDER_DEBOUNCE_MS);
  const result = useMemo(() => renderMarkdown(debounced), [debounced]);
  const sectionRef = useRef<HTMLElement>(null);
  useScrollRole('preview', sectionRef);

  return (
    <section ref={sectionRef} className="sm-scroll flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface" aria-label="预览区">
      {docId && content.trim() === '' ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="tx-sm text-fg-2">预览将在此显示</p>
        </div>
      ) : (
        <PreviewErrorBoundary key={docId ?? 'none'}>
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: result.html }} />
        </PreviewErrorBoundary>
      )}
    </section>
  );
}
