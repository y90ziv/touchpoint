import React from 'react';

export interface WellProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

/**
 * Surface Ladder: Well component.
 * Subtle recessed container for grouping items inside a Card or on the Ground.
 * Uses bg-well without borders or card elevation, preventing nested card slop.
 */
export function Well({
  as: Component = 'div',
  className = '',
  children,
  ...props
}: WellProps) {
  return (
    <Component
      className={`bg-well rounded-lg p-3 text-foreground ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
