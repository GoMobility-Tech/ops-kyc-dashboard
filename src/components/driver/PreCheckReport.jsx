import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const humanize = (k = '') => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function PreCheckReport({ report }) {
  const [open, setOpen] = useState(false);
  if (!report) return null;

  const summary  = report.summary || {};
  const passed   = report.passed   || [];
  const failed   = report.failed   || [];
  const warnings = report.warnings || [];

  const overall  = summary.overall || (failed.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS');
  const isPass   = overall === 'PASS';
  const isFail   = overall === 'FAIL';

  const bg = isFail ? 'bg-red-50 border-red-300'
           : !isPass ? 'bg-amber-50 border-amber-300'
           : 'bg-green-50 border-green-300';
  const Icon = isFail ? ShieldAlert : ShieldCheck;
  const iconColor = isFail ? 'text-red-600' : !isPass ? 'text-amber-700' : 'text-accent-green';

  return (
    <div className={`rounded-xl border shadow-card overflow-hidden ${bg}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-white border border-line flex items-center justify-center shrink-0">
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-accent-navy font-semibold text-sm">
            Cross-check Report · <span className={iconColor}>{overall}</span>
          </p>
          <p className="text-ink-muted text-[11px] mt-0.5">
            {summary.passed_count ?? passed.length} passed · {summary.warning_count ?? warnings.length} warnings · {summary.failed_count ?? failed.length} failed
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {failed.length > 0 && (
            <Section title="Failed" tone="danger" items={failed} icon={XCircle} />
          )}
          {warnings.length > 0 && (
            <Section title="Warnings" tone="warning" items={warnings} icon={AlertTriangle} />
          )}
          {passed.length > 0 && (
            <Section title="Passed" tone="success" items={passed} icon={CheckCircle2} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, tone, items, icon: Icon }) {
  const border = tone === 'danger' ? 'border-red-300 bg-white'
              : tone === 'warning' ? 'border-amber-300 bg-white'
              : 'border-green-300 bg-white';
  const iconColor = tone === 'danger' ? 'text-red-600'
                 : tone === 'warning' ? 'text-amber-700'
                 : 'text-accent-green';

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-muted mb-1.5">{title}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className={`rounded-lg border ${border} px-3 py-2 flex items-start gap-2`}>
            <Icon size={13} className={`shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-accent-navy">{humanize(it.check)}</span>
                {it.score != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-ink-muted font-mono">
                    {it.score}%
                  </span>
                )}
                {it.value && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-ink-muted font-mono truncate max-w-[220px]">
                    {String(it.value)}
                  </span>
                )}
                {it.days_left != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-ink-muted">
                    {it.days_left} days left
                  </span>
                )}
              </div>
              {(it.reason || it.note) && (
                <p className="text-ink-muted text-[11px] mt-0.5 leading-snug">{it.reason || it.note}</p>
              )}
              {it.values && (
                <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                  {Object.entries(it.values).map(([k, v]) => (
                    <span key={k} className="font-mono">
                      <span className="text-ink-faint">{k}:</span> <span className="text-ink">{String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
