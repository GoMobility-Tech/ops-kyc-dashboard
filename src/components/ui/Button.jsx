import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:  'bg-accent-navy text-white hover:bg-accent-navyMid active:bg-accent-navy disabled:opacity-60 ring-1 ring-brand-500/40',
  gold:     'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:opacity-60',
  secondary:'bg-surface-alt text-accent-navy border border-line hover:bg-brand-100 hover:border-brand-500 disabled:opacity-60',
  ghost:    'bg-transparent text-ink-muted hover:text-accent-navy hover:bg-brand-100 disabled:opacity-40',
  danger:   'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-60',
  outline:  'bg-white text-accent-navy border border-line hover:border-accent-navy hover:bg-surface-soft disabled:opacity-60',
  success:  'bg-accent-green text-white hover:brightness-110 disabled:opacity-60',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

export default function Button({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconR,
  className = '',
  children,
  disabled,
  ...rest
}) {
  return (
    <Comp
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1
        disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading
        ? <Loader2 size={14} className="animate-spin" />
        : Icon && <Icon size={14} className="shrink-0" />}
      {children}
      {IconR && !loading && <IconR size={14} className="shrink-0" />}
    </Comp>
  );
}
