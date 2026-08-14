import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  /** 图标尺寸（默认 20） */
  iconSize?: number;
  children?: ReactNode;
}

/** 图标按钮：透明底，hover 暖底，focus 焦点环，必带 aria-label */
export default function IconButton({ icon: Icon, label, iconSize = 20, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md bg-transparent text-fg-2 transition-colors duration-150 ease-standard hover:bg-surface-warm active:bg-accent-soft disabled:opacity-40 disabled:pointer-events-none md:h-9 md:min-w-9 ${className}`}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.8} aria-hidden />
      {children}
    </button>
  );
}
