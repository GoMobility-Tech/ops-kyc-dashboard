import React from 'react';

const ITEMS = [
  { tone: 'green',  label: 'Verified',            cls: 'bg-green-100 text-green-800 border-green-400' },
  { tone: 'yellow', label: 'Manual Review',       cls: 'bg-amber-100 text-amber-800 border-amber-400' },
  { tone: 'red',    label: 'Rejected',            cls: 'bg-red-100   text-red-800   border-red-400' },
  { tone: 'blue',   label: 'Staged / Processing', cls: 'bg-blue-100  text-blue-800  border-blue-400' },
  { tone: 'gray',   label: 'Not Uploaded',        cls: 'bg-surface-alt text-ink-muted border-line' },
];

export default function DocStatusLegend({ className = '' }) {
  return (
    <div className={`flex items-center flex-wrap gap-x-3 gap-y-1.5 ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold shrink-0">
        Doc status:
      </span>
      {ITEMS.map(it => (
        <span key={it.tone} className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-4 h-4 rounded border ${it.cls}`} />
          <span className="text-[11px] text-ink-muted">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
