import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalIcon, ChevronDown, Check, X } from 'lucide-react';
import Calendar from './Calendar.jsx';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Select from './Select.jsx';

// ─── Preset helpers ──────────────────────────────────────────────────────────
const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const today       = () => new Date();
const yesterday   = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
const startOfWeek = () => {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - diff);
  return d;
};
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d; };
const startOfLastMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); return d; };
const endOfLastMonth   = () => { const d = new Date(); d.setDate(0); return d; };

const PRESETS = [
  { key: 'today',      label: 'Today',       from: () => today(),          to: () => today() },
  { key: 'yesterday',  label: 'Yesterday',   from: () => yesterday(),      to: () => yesterday() },
  { key: 'this_week',  label: 'This Week',   from: () => startOfWeek(),    to: () => today() },
  { key: 'this_month', label: 'This Month',  from: () => startOfMonth(),   to: () => today() },
  { key: 'last_month', label: 'Last Month',  from: () => startOfLastMonth(), to: () => endOfLastMonth() },
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
};

function matchPresetKey(from, to) {
  if (!from && !to) return 'all';
  for (const p of PRESETS) {
    if (from === iso(p.from()) && to === iso(p.to())) return p.key;
  }
  return 'custom';
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function DateRangeFilter({
  from = '',
  to = '',
  field = '',
  fieldOptions = [
    { value: 'created_at',       label: 'Signup Date' },
    { value: 'last_activity_at', label: 'Last KYC Activity' },
  ],
  onChange,
  className = '',
}) {
  const [open,       setOpen]       = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom,  setDraftFrom]  = useState(from);
  const [draftTo,    setDraftTo]    = useState(to);
  const ref = useRef(null);

  useEffect(() => { setDraftFrom(from); setDraftTo(to); }, [from, to]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const activeKey = matchPresetKey(from, to);
  const activePreset = PRESETS.find(p => p.key === activeKey);

  const applyPreset = (p) => {
    onChange?.({ from: iso(p.from()), to: iso(p.to()), field });
    setOpen(false);
  };

  const openCustom = () => {
    setDraftFrom(from);
    setDraftTo(to);
    setCustomOpen(true);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draftFrom) return;
    onChange?.({ from: draftFrom, to: draftTo || draftFrom, field });
    setCustomOpen(false);
  };

  const clear = () => {
    onChange?.({ from: '', to: '', field });
    setOpen(false);
  };

  const label = activePreset
    ? activePreset.label
    : from && to
      ? (from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`)
      : 'All dates';

  const anySet = from || to;

  return (
    <div className={className}>
      <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
        Date range
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {/* Trigger button */}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`inline-flex items-center gap-2 bg-white rounded-lg border px-3 py-2 transition
              ${open ? 'border-accent-navy ring-2 ring-brand-500/30' : 'border-line hover:border-accent-navy'}`}
          >
            <CalIcon size={14} className="text-accent-navy" />
            <span className="text-sm text-ink font-medium">{label}</span>
            {anySet && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); clear(); }}
                className="text-ink-faint hover:text-red-600 transition"
                aria-label="Clear"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown size={14} className={`text-ink-muted transition ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-40 mt-1 left-0 w-56 bg-white rounded-lg border border-line shadow-pop overflow-hidden">
              <button
                type="button"
                onClick={clear}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition
                  ${activeKey === 'all' ? 'bg-brand-100 text-accent-navy font-semibold' : 'text-ink hover:bg-surface-alt'}`}
              >
                <span className="flex-1">All dates</span>
                {activeKey === 'all' && <Check size={13} className="text-accent-navy" />}
              </button>
              {PRESETS.map(p => {
                const active = activeKey === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition
                      ${active ? 'bg-brand-100 text-accent-navy font-semibold' : 'text-ink hover:bg-surface-alt'}`}
                  >
                    <span className="flex-1">{p.label}</span>
                    {active && <Check size={13} className="text-accent-navy" />}
                  </button>
                );
              })}
              <div className="border-t border-line" />
              <button
                type="button"
                onClick={openCustom}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition
                  ${activeKey === 'custom' ? 'bg-brand-100 text-accent-navy font-semibold' : 'text-ink hover:bg-surface-alt'}`}
              >
                <CalIcon size={13} />
                <span className="flex-1">Custom range…</span>
                {activeKey === 'custom' && <Check size={13} className="text-accent-navy" />}
              </button>
            </div>
          )}
        </div>

        {/* Field selector — only meaningful if a range is set */}
        <Select
          value={field}
          onChange={(v) => onChange?.({ from, to, field: v })}
          options={fieldOptions}
          size="sm"
          placeholder="Date field"
          className="min-w-[190px]"
        />
      </div>

      {/* Custom range modal */}
      {customOpen && (
        <Modal
          open
          onClose={() => setCustomOpen(false)}
          title="Choose custom date range"
          footer={
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-muted">
                {draftFrom
                  ? (draftTo && draftFrom !== draftTo
                    ? `${fmtDate(draftFrom)} → ${fmtDate(draftTo)}`
                    : fmtDate(draftFrom))
                  : 'Pick a start date, then an end date'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
                <Button onClick={applyCustom} disabled={!draftFrom}>Apply</Button>
              </div>
            </div>
          }
        >
          <div className="flex justify-center">
            <Calendar
              from={draftFrom}
              to={draftTo}
              onChange={({ from: f, to: t }) => { setDraftFrom(f); setDraftTo(t); }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
