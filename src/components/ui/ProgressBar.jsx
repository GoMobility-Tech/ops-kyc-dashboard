import React from 'react';

const FILLS = {
  brand:   'bg-brand-600',
  navy:    'bg-accent-navy',
  success: 'bg-accent-green',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
};

/**
 * Horizontal progress bar with an optional threshold tick.
 *
 * value / max are in whatever unit the caller likes; `marker` (same unit)
 * draws a vertical line, e.g. the break-alert threshold inside the longer
 * force-offline track.
 */
export default function ProgressBar({
  value = 0, max = 100, tone = 'brand', marker, markerTitle,
  height = 8, className = '',
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const markerPct = marker != null && max > 0 ? Math.min(100, Math.max(0, (marker / max) * 100)) : null;

  return (
    <div className={`relative w-full rounded-full bg-brand-200 overflow-hidden ${className}`} style={{ height }}>
      <div className={`h-full rounded-full transition-all ${FILLS[tone] || FILLS.brand}`} style={{ width: `${pct}%` }} />
      {markerPct != null && (
        <div
          title={markerTitle}
          className="absolute top-0 bottom-0 w-px bg-accent-navy/70"
          style={{ left: `${markerPct}%` }}
        />
      )}
    </div>
  );
}
