import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { GripVertical } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';
import { useUiStore } from '../../stores/ui.store';
import { usePasteImage } from '../../hooks/usePasteImage';
import { useScrollRole } from '../../hooks/useScrollSync';
import { computeActiveLine } from '../../utils/editor';
import ActiveLineHighlight from './ActiveLineHighlight';

interface TextareaEditorProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
}

/** 源码编辑区：textarea + 光标行高亮 + 打字机模式 + 粘贴/拖拽图片 + 空态语法速览（UIUX-V2 §4.1/§5.1） */
export default function TextareaEditor({ textareaRef, insertAtCursor }: TextareaEditorProps) {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const docId = useEditorStore((s) => s.docId);
  const typewriterMode = useUiStore((s) => s.typewriterMode);
  const { onPaste, onDrop } = usePasteImage(insertAtCursor);

  const [cursorLine, setCursorLine] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [hasVScroll, setHasVScroll] = useState(false);
  const activeLineRef = useRef<HTMLSpanElement>(null);

  const updateCursorLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setCursorLine(computeActiveLine(ta.value, ta.selectionStart));
  }, [textareaRef]);

  const updateScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setScrollTop(ta.scrollTop);
    setHasVScroll(ta.scrollHeight > ta.clientHeight);
  }, [textareaRef]);

  // 内容/光标变化后重算（含来自命令总线 applyCommand 的选区恢复）
  useEffect(() => {
    updateCursorLine();
    updateScroll();
  }, [content, updateCursorLine, updateScroll]);

  // 打字机模式：光标所在行滚动到视口垂直中心（Ctrl+Shift+T 开关）
  useEffect(() => {
    if (!typewriterMode) return;
    const ta = textareaRef.current;
    const lineEl = activeLineRef.current;
    if (!ta || !lineEl) return;
    const target = lineEl.offsetTop - ta.clientHeight / 2;
    ta.scrollTop = Math.max(0, target);
    updateScroll();
  }, [cursorLine, typewriterMode, content, textareaRef, updateScroll]);

  // 滚动同步：textarea 是编辑侧滚动容器（分屏时与预览互相同步）
  useScrollRole('editor', textareaRef as RefObject<HTMLElement | null>);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface">
      {/* 编辑区：撑满整个左侧区域全宽可编辑，上下 32px、左右 32px 适度内边距（不贴边不影响阅读） */}
      <div className="group relative w-full flex-1">
        {/* C 版块手柄（视觉占位；拖拽功能 v3.1 迭代；PAGES §4） */}
        {docId && (
          <GripVertical
            size={16}
            strokeWidth={1.8}
            aria-hidden
            className="pointer-events-none absolute left-2 top-[var(--space-6)] text-block-handle opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:text-block-handle-active"
          />
        )}
        <ActiveLineHighlight
          content={content}
          cursorLine={cursorLine}
          hasVScroll={hasVScroll}
          scrollTop={scrollTop}
          activeLineRef={activeLineRef}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onSelect={updateCursorLine}
          onScroll={updateScroll}
          onPaste={onPaste}
          onDrop={onDrop}
          spellCheck={false}
          aria-label="Markdown 编辑区"
          aria-multiline="true"
          placeholder={docId ? '' : '打开或新建一篇文档开始写作'}
          className="relative z-[1] sm-scroll block h-full w-full resize-none border-0 bg-transparent px-[var(--space-8)] py-[var(--space-6)] tx-editor lh-editor text-fg outline-none placeholder:text-fg-2"
          style={{ tabSize: 2 }}
        />
        {docId && content.trim() === '' && <EmptyHint />}
      </div>
    </div>
  );
}

/** 空态引导：不打断输入（pointer-events-none，设计指定文案） */
function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-x-[var(--space-8)] top-[var(--space-6)] z-[2] select-none" aria-hidden>
      <p className="tx-lg wt-medium text-fg-2">用 Markdown 开始写作</p>
      <ul className="mt-3 space-y-1.5 tx-sm text-fg-2">
        <li><span className="font-mono text-fg"># 标题</span> 一级标题</li>
        <li><span className="font-mono text-fg">- 列表</span> 无序列表</li>
        <li><span className="font-mono text-fg">**加粗**</span> 强调文本</li>
        <li><span className="font-mono text-fg">```代码```</span> 代码块</li>
        <li><span className="font-mono text-fg">| 表格 |</span> GFM 表格</li>
        <li><span className="font-mono text-fg">{'> 引用'}</span> 引用块</li>
      </ul>
      <p className="mt-4 tx-xs text-fg-2">可直接粘贴图片，自动内嵌到文档</p>
    </div>
  );
}
