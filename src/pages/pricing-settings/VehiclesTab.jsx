import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, PowerOff } from 'lucide-react';
import { Card, Badge, Button, Alert, Modal, Input, Select } from '../../components/ui';
import { FieldGrid, useRowEditor } from './FieldGrid.jsx';
import SaveBar from './SaveBar.jsx';
import {
  VEHICLE_GROUPS, VEHICLE_FIELDS, splitVehiclePatch, fmtRupees, conveniencePreview,
} from './pricingMeta.js';
import { updatePricingVehicle, createPricingVehicle } from '../../api/opsApi.js';

// ─── Convenience fee — rider ko sach me kya lagta hai ───────────────────────
//
// Do number box (off-peak / peak) apne aap jhoot bolte hain: wo STARTING point
// hain, final nahi. Distance band unhe multiply karta hai, aur wo multiplier
// ek alag tab pe baitha hai.
//
// Ops ne ye poocha: "₹15 static hai, par multiplier bhi chalta hai — to 15 hai
// kya?" Jawab screen pe hona chahiye, doc me nahi.
function ConveniencePreview({ draft, tiers }) {
  const cells = conveniencePreview(draft, tiers);
  if (!cells.length) return null;

  const switched = cells.find(c => c.byPct);

  return (
    <div className="rounded-lg border border-line bg-surface-alt px-3 py-2.5 mt-1">
      <p className="text-[11px] font-semibold text-accent-navy mb-1.5">
        What the rider is actually charged
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {cells.map(c => (
          <span key={c.km} className="text-[11px] tabular-nums">
            <span className="text-ink-faint">{c.km}km</span>
            <span className="text-ink font-semibold ml-1">₹{c.amount.toFixed(2)}</span>
            <span className="text-ink-faint ml-0.5">
              {c.byPct ? `(${c.pct}%)` : `(${c.multiplier}×)`}
            </span>
          </span>
        ))}
      </div>
      <p className="text-[10px] text-ink-faint mt-1.5 leading-relaxed">
        Base fare × share × distance band. On longer rides the percentage from the
        Distance tab takes over once it is the bigger of the two
        {switched ? ` — here that happens around ${switched.km} km.` : '.'}
      </p>
    </div>
  );
}

// ─── One vehicle ────────────────────────────────────────────────────────────
//
// Collapsed by default. A vehicle has thirty editable fields and there are six
// of them; opening every one at once turns the screen into a wall nobody reads,
// and the summary line answers the question that gets asked most ("what does a
// car cost right now?") without expanding anything.
function VehicleCard({ row, tiers, onSaved, onError }) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const { draft, set, reset, patch, changedCount, original } = useRowEditor(row, VEHICLE_FIELDS);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePricingVehicle(row.vehicle_type, splitVehiclePatch(patch));
      onSaved(res, `${row.display_name || row.vehicle_type} updated`);
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-alt transition"
      >
        {open ? <ChevronDown size={16} className="text-ink-faint shrink-0" />
              : <ChevronRight size={16} className="text-ink-faint shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">{row.display_name || row.vehicle_type}</span>
            <Badge tone="neutral">{row.vehicle_type}</Badge>
            {!row.is_active && <Badge tone="danger" icon={PowerOff}>Hidden from app</Badge>}
            {changedCount > 0 && <Badge tone="warning">{changedCount} unsaved</Badge>}
          </div>
          <p className="text-[11px] text-ink-muted mt-0.5 tabular-nums">
            Base {fmtRupees(row.base_fare)} · {fmtRupees(row.per_km_rate)}/km · min {fmtRupees(row.minimum_fare)}
            {` · conv ${fmtRupees((Number(row.base_fare) || 0) * (Number(row.convenience_base_mult) || 1))}`}
          </p>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-5 border-t border-line">
          {VEHICLE_GROUPS.map(g => (
            <div key={g.title} className="space-y-2">
              <div>
                <h4 className="text-xs font-bold text-accent-navy uppercase tracking-wider">{g.title}</h4>
                {g.help && <p className="text-[11px] text-ink-faint mt-0.5">{g.help}</p>}
              </div>
              <FieldGrid
                fields={g.fields}
                draft={draft}
                original={original}
                onChange={set}
                disabled={saving}
              />
              {g.preview === 'convenience' && (
                <ConveniencePreview draft={draft} tiers={tiers} />
              )}
            </div>
          ))}
          <SaveBar changedCount={changedCount} saving={saving} onSave={save} onReset={reset} />
        </div>
      )}
    </Card>
  );
}

// ─── Setting up a vehicle that has no pricing row ───────────────────────────
//
// The backend sends `availableToAdd`: types the app already recognises but
// which are priced nowhere. Without this they are invisible here and a booking
// for them fails with no clue why.
function AddVehicleModal({ open, onClose, types, onSaved, onError }) {
  const [form, setForm] = useState({
    vehicle_type: '', display_name: '', vehicle_class: 'car_side',
    base_fare: '', per_km_rate: '', minimum_fare: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const ready = form.vehicle_type && form.display_name && form.vehicle_class
    && form.base_fare !== '' && form.per_km_rate !== '' && form.minimum_fare !== '';

  const submit = async () => {
    setSaving(true);
    try {
      const res = await createPricingVehicle({
        vehicle_type:  form.vehicle_type,
        display_name:  form.display_name,
        vehicle_class: form.vehicle_class,
        base_fare:     Number(form.base_fare),
        per_km_rate:   Number(form.per_km_rate),
        minimum_fare:  Number(form.minimum_fare),
      });
      onSaved(res, `${form.display_name} is now set up`);
      onClose();
    } catch (err) {
      onError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Set up a vehicle">
      <div className="space-y-3">
        <Alert tone="warning">
          This makes the category bookable as soon as it is saved. The five fields
          below have no safe default — a vehicle priced at zero runs free rides.
        </Alert>
        <Select
          label="Vehicle type"
          value={form.vehicle_type}
          onChange={(v) => set('vehicle_type', v)}
          options={types.map(t => ({ value: t, label: t }))}
          placeholder="Pick a type"
        />
        <Input label="Display name" value={form.display_name}
               onChange={(e) => set('display_name', e.target.value)} placeholder="GO Sedan" />
        <Select
          label="Class"
          value={form.vehicle_class}
          onChange={(v) => set('vehicle_class', v)}
          options={[
            { value: 'two_wheel',   label: 'Two wheeler' },
            { value: 'three_wheel', label: 'Three wheeler' },
            { value: 'car_side',    label: 'Car' },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Base fare" type="number" value={form.base_fare}
                 onChange={(e) => set('base_fare', e.target.value)} />
          <Input label="Per km" type="number" value={form.per_km_rate}
                 onChange={(e) => set('per_km_rate', e.target.value)} />
          <Input label="Minimum" type="number" value={form.minimum_fare}
                 onChange={(e) => set('minimum_fare', e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} loading={saving} disabled={!ready}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function VehiclesTab({ data, tiers, onSaved, onError }) {
  const [adding, setAdding] = useState(false);
  const vehicles = data?.vehicles || [];
  const canAdd   = data?.availableToAdd || [];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-ink-muted max-w-2xl leading-relaxed">
          Every category the app can book, including the ones switched off. A saved
          change applies to the <strong>next quote</strong> — rides already in progress
          keep the fare they were booked at.
        </p>
        {canAdd.length > 0 && (
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Set up ({canAdd.length})
          </Button>
        )}
      </div>

      {vehicles.map(v => (
        <VehicleCard key={v.vehicle_type} row={v} tiers={tiers} onSaved={onSaved} onError={onError} />
      ))}

      <AddVehicleModal
        open={adding}
        onClose={() => setAdding(false)}
        types={canAdd}
        onSaved={onSaved}
        onError={onError}
      />
    </div>
  );
}
