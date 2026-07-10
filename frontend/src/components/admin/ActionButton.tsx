'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

type ActionButtonProps = {
  children: ReactNode;
  pending?: boolean;
  variant?: 'accent' | 'secondary' | 'muted' | 'danger';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export function ActionButton({
  children,
  pending = false,
  variant = 'accent',
  disabled,
  ...props
}: ActionButtonProps) {
  const className = props.className || `btn-${variant === 'accent' ? 'accent' : variant === 'secondary' ? 'secondary' : variant === 'danger' ? 'danger' : 'secondary'}`;
  return (
    <button {...props} className={className} disabled={disabled || pending} aria-busy={pending}>
      {pending ? '處理中...' : children}
    </button>
  );
}
