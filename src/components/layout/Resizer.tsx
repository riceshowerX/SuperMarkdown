import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizerProps {
  onResize: (ratio: number) => void;
  /** 分隔条方向（当前仅水平分栏） */
  vertical?: boolean;
}

/** 可拖拽分隔条（C 版 chrome 退化：默认透明，hover 显 --border，拖拽中显 --accent；PAGES §8）
 *  SM-31：setDragging 在取得容器后才置位；比例加 Number.isFinite 守卫；
 *  卸载时复位 body 样式并移除 window 监听；rect 在 onMove 内实时读取。 */
export default function Resizer({ onResize, vertical = false }: ResizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  /** 拖拽期间的清理函数（onUp），卸载时兜底调用 */
  const cleanupRef = useRef<(() => void) | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // 先取得容器，取不到则不改变任何状态（避免 dragging 卡死为 true）
      const container = containerRef.current?.parentElement;
      if (!container) return;
      draggingRef.current = true;
      setDragging(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        // 实时读取 rect：拖拽中布局变化（窗口缩放等）时比例不漂移
        const box = containerRef.current?.parentElement?.getBoundingClientRect();
        if (!box || box.width <= 0) return;
        const ratio = (ev.clientX - box.left) / box.width;
        if (!Number.isFinite(ratio)) return; // 防御 NaN/Infinity 进入布局状态
        onResize(ratio);
      };
      const onUp = () => {
        draggingRef.current = false;
        setDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        cleanupRef.current = null;
      };
      cleanupRef.current = onUp;
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onResize],
  );

  // 卸载兜底：复位 body 样式并移除 window 监听，避免组件随视图切换卸载后的泄漏
  useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    [],
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
