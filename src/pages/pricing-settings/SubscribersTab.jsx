import React, { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Alert, Card, Badge, EmptyState } from '../../components/ui';
import { FieldGrid, useRowEditor } from './FieldGrid.jsx';
import SaveBar from './SaveBar.jsx';
import { SUBSCRIBER_FIELDS, fmtRupees } from './pricingMeta.js';
import { updatePricingSubscriber } from '../../api/opsApi.js';

function TierCard({ row, onSaved, onError }) {
  const [saving, setSaving] = useState(false);
  const { draft, set, reset, patch, changedCount, original } = useRowEditor(row, SUBSCRIBER_FIELDS);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePricingSubscriber(row.tier_name, patch);
      onSaved(res, `${row.display_label || row.tier_name} saved`);
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
        <h4 className="text-sm font-semibold text-ink capitalize">
          {row.display_label || row.tier_name}
        </h4>
        <Badge tone="brand">{fmtRupees(row.monthly_price)}/month</Badge>
        {!row.is_active && <Badge tone="danger">Not on sale</Badge>}
      </div>
      <FieldGrid
        fields={SUBSCRIBER_FIELDS}
        draft={draft}
        original={original}
        onChange={set}
        disabled={saving}
      />
      <SaveBar changedCount={changedCount} saving={saving} onSave={save} onReset={reset} />
    </Card>
  );
}

export default function SubscribersTab({ subscribers, onSaved, onError }) {
  const rows = subscribers || [];
  return (
    <div className="space-y-3">
      <Alert tone="info">
        GO Pass tiers. Benefits are counted per rider per period — turning a tier off
        stops new sales, it does not cancel passes already bought.
      </Alert>

      {rows.length === 0
        ? <EmptyState icon={BadgeCheck} title="No GO Pass tiers" description="Nothing is configured yet." />
        : rows.map(r => <TierCard key={r.tier_name} row={r} onSaved={onSaved} onError={onError} />)}
    </div>
  );
}
