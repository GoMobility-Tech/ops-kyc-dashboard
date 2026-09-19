import React, { useState, useMemo } from 'react';
import { Lock, Info, Search } from 'lucide-react';
import { Card, Badge, Alert, Input, Select, EmptyState } from '../../components/ui';
import SaveBar from './SaveBar.jsx';
import { updatePricingSetting } from '../../api/opsApi.js';
import { fmtWhen } from './pricingMeta.js';

// ─── Settings ───────────────────────────────────────────────────────────────
//
// This tab is not hardcoded. The backend ships a field catalog
// (GET /settings/meta) carrying the label, group, type, unit, safe range and
// help line for every key it is willing to expose, and the form is built from
// it. A new pricing setting therefore appears here with no frontend release —
// which is the whole reason the catalog exists.
//
// Two states the catalog distinguishes, both shown:
//
//   stored: false  The fare engine is using a built-in fallback because the row
//                  does not exist in the table. Saving once creates it. Without
//                  this the box would render empty for a setting that is
//                  quietly in force.
//   meta: null     An engineer-only key with no catalog entry. Shown read-only
//                  rather than hidden, so nothing about live pricing is
//                  invisible on the screen that claims to show pricing.

function SettingRow({ row, onSaved, onError }) {
  const meta = row.meta;
  const [value, setValue]   = useState(
    meta?.type === 'boolean'
      ? String(row.setting_value).toLowerCase() === 'true'
      : row.setting_value ?? ''
  );
  const [saving, setSaving] = useState(false);

  const originalValue = meta?.type === 'boolean'
    ? String(row.setting_value).toLowerCase() === 'true'
    : row.setting_value ?? '';
  const changed = String(value) !== String(originalValue);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePricingSetting(row.setting_key, value);
      onSaved(res, `${meta?.label || row.setting_key} saved`);
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const range = meta && (meta.min != null || meta.max != null)
    ? `${meta.min ?? '−∞'} to ${meta.max ?? '∞'}`
    : null;

  return (
    <Card className={changed ? 'ring-2 ring-brand-500/40' : ''}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-ink">{meta?.label || row.setting_key}</h4>
            {!row.stored && <Badge tone="info" icon={Info}>Built-in default</Badge>}
            {meta?.unit && <Badge tone="neutral">{meta.unit}</Badge>}
          </div>
          <p className="text-[11px] text-ink-faint mt-0.5 font-mono">{row.setting_key}</p>
          {(meta?.help || row.description) && (
            <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed max-w-2xl">
              {meta?.help || row.description}
            </p>
          )}
          {!row.stored && (
            <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
              No row in the table — the fare engine is using this value as a fallback.
              Saving it once makes it a real setting.
            </p>
          )}
          {row.updated_at && (
            <p className="text-[10px] text-ink-faint mt-1">Last changed {fmtWhen(row.updated_at)}</p>
          )}
        </div>

        <div className="w-full sm:w-64 shrink-0 space-y-2">
          {meta?.type === 'boolean' ? (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(value)}
              onClick={() => setValue(v => !v)}
              disabled={saving}
              className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition
                ${value ? 'border-accent-green bg-green-50' : 'border-line bg-white'}`}
            >
              <span className="text-xs font-semibold text-ink">{value ? 'On' : 'Off'}</span>
              <span className={`relative w-11 h-6 rounded-full transition shrink-0
                ${value ? 'bg-accent-green' : 'bg-surface-alt border border-line'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
                  ${value ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
          ) : meta?.options ? (
            <Select
              value={String(value)}
              onChange={setValue}
              options={meta.options.map(o => ({ value: o, label: o }))}
              size="sm"
            />
          ) : (
            <Input
              type={meta?.type === 'number' ? 'number' : 'text'}
              inputMode={meta?.type === 'number' ? 'decimal' : undefined}
              step={meta?.step}
              min={meta?.min}
              max={meta?.max}
              value={value}
              disabled={saving || !meta}
              onChange={(e) => setValue(e.target.value)}
              hint={range ? `Allowed: ${range}` : undefined}
              className="tabular-nums"
            />
          )}

          {meta ? (
            <SaveBar
              changedCount={changed ? 1 : 0}
              saving={saving}
              onSave={save}
              onReset={() => setValue(originalValue)}
            />
          ) : (
            <p className="text-[11px] text-ink-faint flex items-center gap-1 justify-end">
              <Lock size={10} /> Engineer-only key
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function SettingsTab({ settings, metaGroups, onSaved, onError }) {
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');

  // Group labels come from the catalog. Anything with no catalog entry is
  // collected under one heading at the end rather than dropped.
  const groupOptions = useMemo(() => ([
    { value: '', label: 'All groups' },
    ...(metaGroups || []).map(g => ({ value: g.group, label: g.label || g.group })),
    { value: '__raw', label: 'Engineer-only' },
  ]), [metaGroups]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (settings || []).filter(r => {
      if (group === '__raw' && r.meta) return false;
      if (group && group !== '__raw' && r.meta?.group !== group) return false;
      if (!needle) return true;
      return r.setting_key.toLowerCase().includes(needle)
        || (r.meta?.label || '').toLowerCase().includes(needle);
    });
  }, [settings, group, q]);

  const editable = rows.filter(r => r.meta);
  const raw      = rows.filter(r => !r.meta);

  return (
    <div className="space-y-3">
      <Alert tone="info">
        These are the levers the fare engine reads directly — surge, night charges,
        cancellation, fraud thresholds. A change takes effect on the{' '}
        <strong>next quote</strong>, on every API server.
      </Alert>

      <div className="flex items-center gap-2 flex-wrap">
        {/* A plain input, not the shared SearchBar — that one only reports on
            Enter, and this filter is a local array scan where live is better. */}
        <Input
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a setting…"
          containerClassName="flex-1 min-w-[200px]"
        />
        <Select value={group} onChange={setGroup} options={groupOptions} size="sm" className="w-48" />
      </div>

      {rows.length === 0 && (
        <EmptyState title="Nothing matches" description="Try a different search or group." />
      )}

      {editable.map(r => (
        <SettingRow key={r.setting_key} row={r} onSaved={onSaved} onError={onError} />
      ))}

      {raw.length > 0 && (
        <>
          <div className="pt-3">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={11} /> Engineer-only keys
            </h3>
            <p className="text-[11px] text-ink-faint mt-0.5 max-w-2xl leading-relaxed">
              Rows in the table with no catalog entry. Shown so nothing in live pricing
              is hidden, but not editable here — a control that saves cleanly and
              changes nothing is worse than no control at all.
            </p>
          </div>
          {raw.map(r => (
            <SettingRow key={r.setting_key} row={r} onSaved={onSaved} onError={onError} />
          ))}
        </>
      )}
    </div>
  );
}
