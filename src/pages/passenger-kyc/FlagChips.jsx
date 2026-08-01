import React from 'react';
import { Badge } from '../../components/ui';
import { flagMeta } from './passengerMeta.js';

/**
 * Renders `flag_reasons` as chips. A passenger can carry several at once.
 * `max` truncates with a "+n" chip (used in the dense list view).
 */
export default function FlagChips({ flags = [], max, className = '' }) {
  const list = Array.isArray(flags) ? flags.filter(Boolean) : [];
  if (!list.length) return <span className="text-[11px] text-ink-faint">—</span>;

  const shown  = max ? list.slice(0, max) : list;
  const hidden = list.length - shown.length;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map(code => {
        const meta = flagMeta(code);
        return (
          <Badge key={code} tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
        );
      })}
      {hidden > 0 && (
        <span title={list.slice(shown.length).map(c => flagMeta(c).label).join(', ')}>
          <Badge tone="neutral">+{hidden}</Badge>
        </span>
      )}
    </div>
  );
}
