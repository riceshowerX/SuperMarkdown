import { useCallback, useRef } from 'react';

interface ResizerProps {
  onResize: (ratio: number) => void;
  /** 分隔条方向（当前仅水平分栏） */
  vertical?: boolean;
}

/** 可拖拽分隔条（4px，hover accent；拖拽期间禁选中） */
export default function Resizer({ onResize, vertical = false }: ResizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
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
      className={`group relative z-10 shrink-0 bg-border transition-colors duration-150 hover:bg-accent ${
        vertical ? 'h-1 w-full cursor-row-resize' : 'w-1 cursor-col-resize'
      }`}
    />
  );
}
