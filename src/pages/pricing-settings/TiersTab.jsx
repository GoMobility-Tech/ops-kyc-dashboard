import React, { useState } from 'react';
import { Ruler } from 'lucide-react';
import { Alert, Card, Badge, EmptyState } from '../../components/ui';
import { FieldGrid, useRowEditor } from './FieldGrid.jsx';
import SaveBar from './SaveBar.jsx';
import { TIER_FIELDS, num } from './pricingMeta.js';
import { savePricingTier } from '../../api/opsApi.js';

const band = (row) => {
  const from = num(row.min_km) ?? 0;
  const to   = num(row.max_km);
  return to === null ? `${from} km and beyond` : `${from}–${to} km`;
};

function TierCard({ row, onSaved, onError }) {
  const [saving, setSaving] = useState(false);
  const { draft, set, reset, patch, changedCount, original } = useRowEditor(row, TIER_FIELDS);

  const save = async () => {
    setSaving(true);
    try {
      const res = await savePricingTier(row.tier_name, patch);
      onSaved(res, `${row.tier_name} tier saved`);
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-semibold text-ink capitalize">{row.tier_name}</h4>
        <Badge tone="neutral">{band(row)}</Badge>
        <Badge tone={num(row.multiplier) === 1 ? 'neutral' : 'brand'}>
          ×{num(row.multiplier)?.toFixed(2)}
        </Badge>
        {!row.is_active && <Badge tone="danger">Off</Badge>}
      </div>
      <FieldGrid
        fields={TIER_FIELDS}
        draft={draft}
        original={original}
        onChange={set}
        disabled={saving}
        cols={4}
      />
      <SaveBar changedCount={changedCount} saving={saving} onSave={save} onReset={reset} />
    </Card>
  );
}

export default function TiersTab({ tiers, onSaved, onError }) {
  const rows = tiers || [];
  return (
    <div className="space-y-3">
      <Alert tone="info">
        These bands multiply the <strong>convenience fee only</strong> — not the base fare
        and not the per-km fare. A car&rsquo;s ₹15 off-peak fee becomes ₹11.25 on a 2 km ride
        and ₹21 on a 30 km one. Bands must meet without a gap: a distance that lands in no
        band gets no multiplier at all.
      </Alert>

      {rows.length === 0
        ? <EmptyState icon={Ruler} title="No distance tiers" description="Nothing is configured yet." />
        : rows.map(t => <TierCard key={t.tier_name} row={t} onSaved={onSaved} onError={onError} />)}
    </div>
  );
}
