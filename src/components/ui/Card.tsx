import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  [key: `data-${string}`]: string | number | boolean | undefined;
}

/**
 * Surface Ladder: Card component.
 * Provides a single containment layer surface.
 * Conforms to Hallmark anti-slop rules: single containment layer, semantic borders and lighting.
 */
export function Card({
  as: Component = 'div',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={`bg-card border border-border rounded-xl p-4 text-foreground shadow-sm ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
