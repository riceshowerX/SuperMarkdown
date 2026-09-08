import type { ReactNode } from 'react';

/** 分段控件选项 */
export interface SegmentedOption<T extends string> {
  value: T;
  /** 无障碍名称；touch 模式下同时作为可见文字 */
  label: string;
  icon: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** dense：桌面 h-8 图标-only；touch：移动端 h-11 图标+文字（MUI-09） */
  size?: 'dense' | 'touch';
  ariaLabel: string;
}

/** 共享分段控件（MUI-09）：激活态统一为 accent 底白字，尺寸按场景分化（桌面 32px / 触屏 44px） */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'dense',
  ariaLabel,
}: SegmentedProps<T>) {
  const isTouch = size === 'touch';
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex rounded-md bg-surface-sunken p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded transition-colors duration-150 ${
              isTouch ? 'h-11 flex-1' : 'h-8 w-8'
            } ${isTouch && active ? 'wt-medium ' : ''}${
              active ? 'bg-accent text-on-accent' : 'text-fg-2 hover:text-fg'
            }`}
          >
            {opt.icon}
            {isTouch && opt.label}
          </button>
        );
      })}
    </div>
  );
}
