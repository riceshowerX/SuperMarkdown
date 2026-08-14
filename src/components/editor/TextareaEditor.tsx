import type { RefObject } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { usePasteImage } from '../../hooks/usePasteImage';

interface TextareaEditorProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
}

/** 源码编辑区：textarea + 粘贴/拖拽图片 + 空态语法速览（PAGES §4） */
export default function TextareaEditor({ textareaRef, insertAtCursor }: TextareaEditorProps) {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const docId = useEditorStore((s) => s.docId);
  const { onPaste, onDrop } = usePasteImage(insertAtCursor);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-sunken">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={onPaste}
        onDrop={onDrop}
        spellCheck={false}
        aria-label="Markdown 编辑区"
        aria-multiline="true"
        placeholder={docId ? '' : '打开或新建一篇文档开始写作'}
        className="sm-scroll flex-1 resize-none bg-transparent px-6 py-6 tx-base lh-body text-fg outline-none placeholder:text-fg-2"
        style={{ tabSize: 2 }}
      />
      {docId && content.trim() === '' && <EmptyHint />}
    </div>
  );
}

/** 空态引导：不打断输入（pointer-events-none，设计指定文案） */
function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-x-6 top-8 select-none" aria-hidden>
      <p className="tx-lg wt-medium text-fg-2">用 Markdown 开始写作</p>
      <ul className="mt-3 space-y-1.5 tx-sm text-fg-2">
        <li><span className="font-mono text-accent"># 标题</span> 一级标题</li>
        <li><span className="font-mono text-accent">- 列表</span> 无序列表</li>
        <li><span className="font-mono text-accent">**加粗**</span> 强调文本</li>
        <li><span className="font-mono text-accent">```代码```</span> 代码块</li>
        <li><span className="font-mono text-accent">| 表格 |</span> GFM 表格</li>
        <li><span className="font-mono text-accent">{'> 引用'}</span> 引用块</li>
      </ul>
      <p className="mt-4 tx-xs text-fg-2">可直接粘贴图片，自动内嵌到文档</p>
    </div>
  );
}
