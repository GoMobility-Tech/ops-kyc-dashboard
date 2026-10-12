import React, { useState } from 'react';
import { Pencil, Copy, Trash2, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { Card, Badge, Button, Alert } from '../../../components/ui';
import SlabLadderTable from './SlabLadderTable.jsx';
import SlabPreviewTable from './SlabPreviewTable.jsx';
import { BAND_LABEL, SCOPE_LABEL, rulesToLadder, previewKms } from './slabModel.js';
import { previewSlabRules } from '../../../api/opsApi.js';
import { fmtWhen } from '../pricingMeta.js';

const scopeTone = { global: 'danger', state: 'warning', city: 'navy' };

// One saved set: where it applies, the slab table, and (on demand) what it charges.
export default function SlabSetCard({ set, gst, onEdit, onCopy, onDelete }) {
  const ladder = rulesToLadder(set.rows);
  const [open, setOpen] = useState(false);
  const [prev, setPrev] = useState({ loading: false, data: null, error: '' });

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || prev.data) return;
    setPrev({ loading: true, data: null, error: '' });
    try {
      const res = await previewSlabRules({
        scope: set.scope, scope_id: set.scope_id, vehicle_type: set.vehicle_type, band: set.band,
        km_list: previewKms(ladder),
      });
      setPrev({ loading: false, data: res.data?.data || null, error: '' });
    } catch (err) {
      setPrev({ loading: false, data: null, error: err.response?.data?.message || 'Could not load the fare examples' });
    }
  };

  const name = set.scope === 'global' ? 'All cities' : (set.scope_name || `${SCOPE_LABEL[set.scope]} ${set.scope_id}`);

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-accent-navy">{name}</h4>
            <Badge tone={scopeTone[set.scope]}>{SCOPE_LABEL[set.scope]}</Badge>
            <Badge tone="brand" className="capitalize">{set.vehicle_type}</Badge>
            <Badge tone="neutral">{BAND_LABEL[set.band]}</Badge>
            {!set.valid && <Badge tone="danger" icon={AlertTriangle}>Invalid — not used</Badge>}
          </div>
          <p className="text-[11px] text-ink-faint">
            Updated {fmtWhen(set.updated_at)}{set.note ? ` · ${set.note}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => onEdit(set)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={Copy} onClick={() => onCopy(set)} title="Use these slabs for other cities">Copy to…</Button>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(set)} className="hover:!text-red-600" title="Remove this set">Remove</Button>
        </div>
      </div>

      {!set.valid && (
        <Alert tone="danger" title="This set has a problem, so rides ignore it and use the old engine">
          <ul className="list-disc ml-4 space-y-0.5">{(set.errors || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Alert>
      )}

      <SlabLadderTable ladder={ladder} />

      <button type="button" onClick={toggle}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-navy hover:text-accent-navyMid">
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'Show'} fare examples
        {prev.loading && <Loader2 size={12} className="animate-spin" />}
      </button>
      {open && prev.error && <Alert tone="danger">{prev.error}</Alert>}
      {open && prev.data && <SlabPreviewTable preview={prev.data.preview} gst={gst} errors={prev.data.valid === false ? prev.data.errors : []} />}
    </Card>
  );
}
