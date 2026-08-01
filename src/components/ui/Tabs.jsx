import React from 'react';

/**
 * Horizontal tab strip.
 *
 * tabs: [{ value, label, icon?, count? }]
 * Scrolls sideways on narrow screens instead of wrapping, so the tab row keeps
 * its single-line shape on a phone.
 */
export default function Tabs({ tabs = [], value, onChange, className = '', size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs';

  return (
    <div className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}>
      {tabs.map(t => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange?.(t.value)}
            className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition ${pad}
              ${active
                ? 'border-brand-600 text-accent-navy bg-brand-100'
                : 'border-transparent text-ink-muted hover:text-accent-navy hover:bg-surface-alt'}`}
          >
            {Icon && <Icon size={13} />}
            {t.label}
            {t.count != null && (
              <span className={`text-[10px] px-1.5 rounded-full tabular-nums font-bold
                ${active ? 'bg-accent-navy text-brand-400' : 'bg-surface-alt text-ink-muted'}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
