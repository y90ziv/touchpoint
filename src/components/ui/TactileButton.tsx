import React from 'react';

export interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * Emil Kowalski Tactile Button Primitive.
 * Features:
 * - 160ms snappy ease-out transition
 * - Responsive :active scale(0.97) feedback
 * - Visible WCAG AA compliant :focus-visible outline
 * - Reduced motion fallback and proper disabled states
 */
export function TactileButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: TactileButtonProps) {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm px-3.5 py-2 rounded-lg gap-2',
    lg: 'text-base px-4 py-2.5 rounded-xl gap-2.5',
    icon: 'p-2 rounded-lg aspect-square',
  }[size];

  const variantStyles = {
    primary: 'bg-primary text-primary-fg hover:opacity-95 shadow-sm',
    secondary: 'bg-background border border-border text-foreground hover:bg-card-hover',
    outline: 'border border-border text-foreground hover:bg-well',
    ghost: 'text-foreground hover:bg-well',
    danger: 'bg-overdue text-primary-fg hover:opacity-95 shadow-sm',
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium motion-safe:transition motion-safe:duration-160 motion-safe:ease-snappy-out motion-safe:active:scale-97 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none cursor-pointer ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
