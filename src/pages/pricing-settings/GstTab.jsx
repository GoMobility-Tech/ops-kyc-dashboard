import React, { useState } from 'react';
import { Alert, Card, CardHeader } from '../../components/ui';
import { FieldGrid, useRowEditor } from './FieldGrid.jsx';
import SaveBar from './SaveBar.jsx';
import { GST_FIELDS, fmtWhen } from './pricingMeta.js';
import { updatePricingGst } from '../../api/opsApi.js';

// One row, so one form. GST is the section most likely to be changed by
// someone who is not an engineer, and the wrong number here is a compliance
// problem rather than a pricing one — hence the warning stays on screen
// instead of appearing after the fact.
export default function GstTab({ gst, onSaved, onError }) {
  const [saving, setSaving] = useState(false);
  const { draft, set, reset, patch, changedCount, original } = useRowEditor(gst, GST_FIELDS);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePricingGst(patch);
      onSaved(res, 'GST settings updated');
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Alert tone="warning">
        These rates appear on every invoice. Changing one affects what riders are
        billed from the next quote onward — it does not restate invoices already issued.
      </Alert>

      <Card className="space-y-4">
        <CardHeader
          title="GST"
          subtitle={gst?.updated_at ? `Last changed ${fmtWhen(gst.updated_at)}` : undefined}
        />
        <FieldGrid
          fields={GST_FIELDS}
          draft={draft}
          original={original}
          onChange={set}
          disabled={saving}
        />
        <SaveBar changedCount={changedCount} saving={saving} onSave={save} onReset={reset} />
      </Card>
    </div>
  );
}
