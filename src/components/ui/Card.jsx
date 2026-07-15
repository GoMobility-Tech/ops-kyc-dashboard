import React from 'react';

export default function Card({
  as: Comp = 'div',
  padding = 'md',
  hover = false,
  className = '',
  children,
  ...rest
}) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-3' : padding === 'lg' ? 'p-5' : 'p-4';
  return (
    <Comp
      {...rest}
      className={`bg-surface-soft rounded-xl border border-line shadow-card ${pad}
        ${hover ? 'hover:border-brand-500 hover:shadow-pop transition' : ''} ${className}`}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({ title, subtitle, right, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
        {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
