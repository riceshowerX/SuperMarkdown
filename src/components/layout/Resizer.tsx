import { useCallback, useRef, useState } from 'react';

interface ResizerProps {
  onResize: (ratio: number) => void;
  /** 分隔条方向（当前仅水平分栏） */
  vertical?: boolean;
}

/** 可拖拽分隔条（C 版 chrome 退化：默认透明，hover 显 --border，拖拽中显 --accent；PAGES §8） */
export default function Resizer({ onResize, vertical = false }: ResizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      setDragging(true);
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const ratio = (ev.clientX - rect.left) / rect.width;
        onResize(ratio);
      };
      const onUp = () => {
        draggingRef.current = false;
        setDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onResize],
  );

  return (
    <div
      ref={containerRef}
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label="调整编辑/预览宽度"
      onMouseDown={onMouseDown}
      className={`group relative z-10 flex shrink-0 items-center justify-center ${
        vertical ? 'h-3 w-full cursor-row-resize' : 'h-full w-3 cursor-col-resize'
      }`}
    >
      {/* 视觉条（1px）：C 版默认透明，hover 显 --border，拖拽中显 --accent */}
      <div
        aria-hidden
        className={`shrink-0 transition-colors duration-150 ${
          vertical ? 'h-1 w-full' : 'h-full w-1'
        } ${dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-border'}`}
      />
    </div>
  );
}
