import React from 'react';

// Small pill switch for 2–4 mutually exclusive choices (scope type, band).
// options: [{ value, label, hint? }]
export default function Segmented({ options, value, onChange, disabled = false, label }) {
  return (
    <div>
      {label && (
        <p className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">{label}</p>
      )}
      <div className={`inline-flex rounded-lg border border-line bg-white p-0.5 ${disabled ? 'opacity-60' : ''}`}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.value)}
              title={o.hint}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap
                ${active ? 'bg-accent-navy text-white shadow-card' : 'text-ink-muted hover:text-accent-navy hover:bg-brand-100'}
                ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
