import React, { useState, useCallback, useMemo } from 'react';
import { Input, Select, Badge } from '../../components/ui';
import { buildPatch, isOff } from './pricingMeta.js';

// ─── One editable field ─────────────────────────────────────────────────────
//
// A pricing field is not a plain text box. Two things matter enough to be built
// in rather than left to each tab:
//
//   • The unit belongs next to the number. "Per km 12" is ambiguous; "₹ 12 /km"
//     is not, and this screen is read by people who do not know the column
//     names.
//   • A field the person has changed but not yet saved must look different from
//     one that is live. Pricing is edited under pressure and a half-finished
//     edit that looks identical to a saved one is how the wrong number ships.

export function Field({ spec, value, original, onChange, disabled }) {
  const dirty = String(value ?? '') !== String(original ?? '');

  if (spec.type === 'boolean') {
    const on = Boolean(value);
    return (
      <div className={`rounded-lg border px-3 py-2 ${dirty ? 'border-brand-600 bg-brand-100/50' : 'border-line bg-white'}`}>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="min-w-0">
            <span className="block text-xs font-medium text-ink-muted">{spec.label}</span>
            {spec.help && <span className="block text-[11px] text-ink-faint mt-0.5 leading-relaxed">{spec.help}</span>}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50
              ${on ? 'bg-accent-green' : 'bg-surface-alt border border-line'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
              ${on ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>
    );
  }

  if (spec.type === 'select') {
    return (
      <div className={dirty ? 'rounded-lg ring-2 ring-brand-500/40' : ''}>
        <Select
          label={spec.label}
          value={value ?? ''}
          onChange={onChange}
          options={spec.options || []}
          disabled={disabled}
          size="sm"
        />
      </div>
    );
  }

  // The unit sits with the number. "Per km 12" is ambiguous to someone who
  // does not know the column; "12 ₹/km" is not.
  const suffix = spec.unit
    ? <span className="text-[11px] text-ink-faint shrink-0">{spec.unit}</span>
    : null;

  return (
    <Input
      label={spec.label}
      type={spec.type === 'number' ? 'number' : 'text'}
      inputMode={spec.type === 'number' ? 'decimal' : undefined}
      step={spec.step}
      min={spec.min}
      max={spec.max}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      suffix={
        <span className="flex items-center gap-1.5 shrink-0">
          {isOff(value) && <Badge tone="neutral">off</Badge>}
          {suffix}
        </span>
      }
      placeholder={spec.nullable ? 'default' : ''}
      hint={spec.help}
      containerClassName={dirty ? 'rounded-lg ring-2 ring-brand-500/40' : ''}
      className={spec.type === 'number' ? 'tabular-nums' : ''}
    />
  );
}

// ─── A group of fields ──────────────────────────────────────────────────────
export function FieldGrid({ fields, draft, original, onChange, disabled, cols = 3 }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${grid} gap-3`}>
      {fields.map(f => (
        <Field
          key={f.key}
          spec={f}
          value={draft?.[f.key]}
          original={original?.[f.key]}
          disabled={disabled}
          onChange={(v) => onChange(f.key, v)}
        />
      ))}
    </div>
  );
}

// ─── Draft state for one row ────────────────────────────────────────────────
//
// Keeps the live row and the edited copy side by side, so the screen can show
// what changed and the save can send only that. `patch` is what goes to the
// API — never the whole row, because the backend rejects unknown keys and a
// row carries several that are not writable.
export function useRowEditor(row, fields) {
  const seed = useMemo(() => {
    const o = {};
    for (const f of fields) {
      const v = row?.[f.key];
      o[f.key] = f.type === 'boolean' ? Boolean(v) : (v ?? '');
    }
    return o;
  }, [row, fields]);

  const [draft, setDraft] = useState(seed);
  const [seeded, setSeeded] = useState(seed);

  // The row can be replaced under us by a refetch after saving. When that
  // happens the draft has to follow, or the form keeps showing stale edits.
  if (seeded !== seed && JSON.stringify(seeded) !== JSON.stringify(seed)) {
    setSeeded(seed);
    setDraft(seed);
  }

  const set = useCallback((key, value) => {
    setDraft(d => ({ ...d, [key]: value }));
  }, []);

  const reset = useCallback(() => setDraft(seed), [seed]);

  const patch = useMemo(() => buildPatch(draft, seed, fields), [draft, seed, fields]);
  const changedCount = Object.keys(patch).length;

  return { draft, set, reset, patch, changedCount, original: seed };
}
