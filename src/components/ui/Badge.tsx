import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'overdue' | 'warning' | 'success' | 'info';
  truncate?: boolean;
}

/**
 * Surface Ladder: Badge / Pill Primitive.
 * Features:
 * - Sentence-case untracked typography
 * - Semantic cadence status variants
 * - True ellipses (…) on truncation
 * - Zero fake status dots (Gate 63 compliant)
 */
export function Badge({
  variant = 'neutral',
  truncate = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium tracking-normal select-none shrink-0 whitespace-nowrap';

  const variantStyles = {
    neutral: 'bg-well text-foreground',
    overdue: 'bg-overdue/10 text-overdue border border-overdue/20',
    warning: 'bg-warning/10 text-warning tp-badge-warning border border-warning/20',
    success: 'bg-success/10 text-success tp-badge-success border border-success/20',
    info: 'bg-info/10 text-info border border-info/20',
  }[variant];

  return (
    <span
      className={`${baseStyles} ${variantStyles} ${truncate ? 'truncate max-w-[180px]' : ''} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
