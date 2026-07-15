import React from 'react';
import { DOCS_META, DONE_STATES, statusForDoc, hasPerDocData } from './driverStatus.js';

// Status → tone mapping. Kept in sync with DocStatusLegend.
export function toneForStatus(status) {
  if (!status || status === 'not_started') return 'gray';   // not uploaded (neutral)
  if (DONE_STATES.has(status))              return 'green';  // verified
  if (status === 'manual_review')           return 'yellow'; // needs review
  if (status === 'rejected')                return 'red';    // rejected (bad)
  return 'blue';                                             // staged / processing / pending
}

const TONE_CLS = {
  green:  'bg-green-100 text-green-800 border-green-400',
  yellow: 'bg-amber-100 text-amber-800 border-amber-400',
  red:    'bg-red-100   text-red-800   border-red-400',
  blue:   'bg-blue-100  text-blue-800  border-blue-400',
  gray:   'bg-surface-alt text-ink-muted border-line',
};

/**
 * Row-level compact strip — one pill per required doc, colored by status.
 * If the driver row has NO per-doc data, renders nothing (caller can fall back).
 */
export default function DocStatusStrip({ driver }) {
  if (!hasPerDocData(driver)) return null;

  return (
    <div className="flex gap-1">
      {DOCS_META.map(d => {
        const st = statusForDoc(driver, d);
        const tone = toneForStatus(st);
        const humanStatus = (st || 'not_started').replace(/_/g, ' ');
        return (
          <span
            key={d.key}
            title={`${d.label}: ${humanStatus}`}
            className={`inline-flex items-center justify-center min-w-[26px] h-5 px-1 rounded border text-[10px] font-bold ${TONE_CLS[tone]}`}
          >
            {d.short}
          </span>
        );
      })}
    </div>
  );
}
