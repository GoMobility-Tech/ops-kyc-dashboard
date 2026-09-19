import React, { useState, useMemo } from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { Alert, Card, Badge, Button, EmptyState, Modal } from '../../components/ui';
import { FieldGrid, useRowEditor } from './FieldGrid.jsx';
import SaveBar from './SaveBar.jsx';
import { PENALTY_FIELDS, fmtRupees, num } from './pricingMeta.js';
import { savePricingPenalty, deletePricingPenalty } from '../../api/opsApi.js';

// Offence rules are keyed by (type, count) — the second, third and fourth time
// a driver does the same thing usually carry different consequences. They are
// grouped by type so the escalation ladder reads top to bottom.
function PenaltyCard({ row, onSaved, onError, onDeleted }) {
  const [saving, setSaving]   = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { draft, set, reset, patch, changedCount, original } = useRowEditor(row, PENALTY_FIELDS);

  const save = async () => {
    setSaving(true);
    try {
      const res = await savePricingPenalty(row.offense_type, row.offense_count, patch);
      onSaved(res, `${row.offense_type} · offence ${row.offense_count} saved`);
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const res = await deletePricingPenalty(row.offense_type, row.offense_count);
      setConfirm(false);
      onDeleted(res, `${row.offense_type} · offence ${row.offense_count} removed`);
    } catch (err) {
      onError(err.response?.data?.message || 'Could not remove');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="navy">Offence #{row.offense_count}</Badge>
          <span className="text-sm font-semibold text-ink tabular-nums">
            {fmtRupees(row.penalty_amount)}
          </span>
          {num(row.suspension_days) > 0 && (
            <Badge tone="warning">{row.suspension_days}-day suspension</Badge>
          )}
          {row.is_permanent_ban && <Badge tone="danger">Permanent ban</Badge>}
          {row.requires_rekyc && <Badge tone="info">Re-KYC</Badge>}
          {!row.is_active && <Badge tone="neutral">Inactive</Badge>}
        </div>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirm(true)} disabled={saving}>
          Remove
        </Button>
      </div>

      <FieldGrid
        fields={PENALTY_FIELDS}
        draft={draft}
        original={original}
        onChange={set}
        disabled={saving}
      />
      <SaveBar changedCount={changedCount} saving={saving} onSave={save} onReset={reset} />

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Remove this rule?">
        <div className="space-y-3">
          <Alert tone="danger">
            Offence #{row.offense_count} for <strong>{row.offense_type}</strong> will no
            longer carry a penalty. Drivers who reach this count get no action at all
            until a rule is put back.
          </Alert>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Keep it</Button>
            <Button variant="danger" size="sm" onClick={remove} loading={saving}>Remove</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default function PenaltiesTab({ penalties, onSaved, onError, onDeleted }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of penalties || []) {
      if (!map.has(p.offense_type)) map.set(p.offense_type, []);
      map.get(p.offense_type).push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (num(a.offense_count) ?? 0) - (num(b.offense_count) ?? 0));
    }
    return [...map.entries()];
  }, [penalties]);

  return (
    <div className="space-y-4">
      <Alert tone="info">
        What happens when a driver breaks a rule, and what happens the next time.
        The escalation window decides how long an offence keeps counting — outside
        it, the count starts again.
      </Alert>

      {grouped.length === 0 && (
        <EmptyState icon={ShieldAlert} title="No penalty rules" description="Nothing is configured yet." />
      )}

      {grouped.map(([type, rows]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-xs font-bold text-accent-navy uppercase tracking-wider">
            {type.replace(/_/g, ' ')}
          </h3>
          {rows.map(r => (
            <PenaltyCard
              key={`${r.offense_type}-${r.offense_count}`}
              row={r}
              onSaved={onSaved}
              onError={onError}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
