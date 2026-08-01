import React from 'react';

const TONES = {
  neutral: 'bg-surface-soft border-line',
  brand:   'bg-brand-100 border-brand-400',
  navy:    'bg-accent-navy border-accent-navy text-white',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
  danger:  'bg-red-50 border-red-200',
  info:    'bg-blue-50 border-blue-200',
};

const VALUE_TONES = {
  neutral: 'text-ink',
  brand:   'text-accent-navy',
  navy:    'text-white',
  success: 'text-green-800',
  warning: 'text-amber-800',
  danger:  'text-red-700',
  info:    'text-blue-800',
};

/**
 * A single KPI number with a label above and optional caption below.
 *
 * `hint` renders as a native tooltip — use it for the caveats the API guide
 * asks us to surface (approximate counts, what a metric actually measures).
 */
export default function StatTile({
  label, value, sub, icon: Icon, tone = 'neutral', hint, onClick, className = '',
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button', onClick } : {})}
      title={hint}
      className={`rounded-xl border p-3 text-left w-full shadow-card ${TONES[tone]}
        ${onClick ? 'hover:shadow-pop transition cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className={tone === 'navy' ? 'text-brand-400' : 'text-ink-muted'} />}
        <p className={`text-[10px] uppercase tracking-wider font-semibold truncate
          ${tone === 'navy' ? 'text-brand-400' : 'text-ink-muted'}`}>
          {label}
        </p>
      </div>
      <p className={`text-xl font-bold mt-1 tabular-nums leading-tight ${VALUE_TONES[tone]}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-[10px] mt-0.5 leading-snug ${tone === 'navy' ? 'text-brand-400/80' : 'text-ink-faint'}`}>
          {sub}
        </p>
      )}
    </Comp>
  );
}
