import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
}

/** 文本按钮：Primary（accent 底）/ Ghost（透明）/ Danger（语义红） */
export default function ActionButton({ variant = 'ghost', className = '', children, ...rest }: ActionButtonProps) {
  const base =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 tx-sm wt-medium transition-colors duration-150 ease-standard disabled:opacity-40 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active',
    ghost: 'bg-transparent text-fg hover:bg-surface-warm active:bg-accent-soft',
    danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
  };
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
