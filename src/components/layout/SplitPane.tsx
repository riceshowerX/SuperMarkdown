import type { ReactNode } from 'react';
import Resizer from './Resizer';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  ratio: number;
  onRatio: (ratio: number) => void;
}

/** 分屏布局：编辑 50%/预览 50%，可拖拽分隔条（最小窗 320px 由 clamp 保证）。
 *  left/right wrapper 必须是 flex-col 容器，否则子级 section 的 flex-1 无效导致高度坍缩为内容高度（编辑区变"小框"）。 */
export default function SplitPane({ left, right, ratio, onRatio }: SplitPaneProps) {
  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-col overflow-hidden" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <Resizer onResize={onRatio} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{right}</div>
    </div>
  );
}
