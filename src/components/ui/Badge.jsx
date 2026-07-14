import React from 'react';

const TONES = {
  neutral: 'bg-surface-alt text-ink-muted border-line',
  brand:   'bg-brand-100 text-brand-800 border-brand-400',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-700 border-red-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  navy:    'bg-blue-50 text-accent-navy border-blue-200',
};

export default function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap
      ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={10} />}
      {children}
    </span>
  );
}
