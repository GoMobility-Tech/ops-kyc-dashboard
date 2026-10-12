import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Button, Card, CardHeader, Badge, Alert } from '../../../components/ui';
import Segmented from './Segmented.jsx';
import ScopePicker from './ScopePicker.jsx';
import SlabPreviewTable from './SlabPreviewTable.jsx';
import { previewSlabRules, saveSlabSet } from '../../../api/opsApi.js';
import {
  COMPONENTS, COMPONENT_LABEL, BAND_LABEL, BAND_HELP, MODE_OPTIONS, MODE_HELP, kmLabel, num,
  addSlab, removeSlab, setSlabEnd, setCell, validateLadder, ladderToRules,
  rulesToLadder, ladderSignature, previewKms, blankLadder,
} from './slabModel.js';

const field = 'bg-white rounded-lg border border-line px-2 py-1.5 text-xs focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60';
const numField = `${field} w-20 tabular-nums text-right`;

const errorText = (err) => err.response?.data?.message
  || err.response?.data?.errors?.[0]?.message
  || err.message
  || 'Something went wrong';

const setKeyOf = (scope, scopeId, vehicle, band) => `${scope}:${scopeId ?? '*'}:${vehicle}:${band}`;

// One cell of the ladder: HOW this component is charged for this distance range.
function CellEditor({ cell, onChange, disabled, bad }) {
  const ring = bad ? 'border-red-300' : '';
  return (
    <div className="space-y-1 min-w-[170px]">
      <select value={cell.mode} disabled={disabled} onChange={e => onChange({ mode: e.target.value })}
              className={`${field} w-full ${ring}`}>
        {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {MODE_HELP[cell.mode] && (
        <p className="text-[10px] text-ink-faint leading-snug max-w-[220px]">{MODE_HELP[cell.mode]}</p>
      )}

      {(cell.mode === 'fixed' || cell.mode === 'per_km') && (
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          ₹
          <input type="number" min="0" step="0.5" value={cell.value} disabled={disabled}
                 onChange={e => onChange({ value: e.target.value })} className={`${numField} ${ring}`} />
          {cell.mode === 'per_km' && <span>/ km</span>}
        </div>
      )}

      {cell.mode === 'percent' && (
        <div className="flex items-center gap-1 text-xs text-ink-muted flex-wrap">
          <input type="number" min="0" step="0.5" value={cell.value} disabled={disabled}
                 onChange={e => onChange({ value: e.target.value })} className={`${numField} w-16 ${ring}`} />
          % of ₹
          <input type="number" min="0" step="1" value={cell.ref} disabled={disabled} placeholder="base fare"
                 title="Leave empty to use the vehicle's own base fare"
                 onChange={e => onChange({ ref: e.target.value })} className={`${numField} w-20 placeholder:text-[10px]`} />
        </div>
      )}
    </div>
  );
}

/**
 * Create / edit / duplicate a slab set.
 *
 * draft: { mode: 'create' | 'edit', scopeType, stateId, cityIds, vehicle, band, note, ladder }
 * In edit mode the target (scope, vehicle, band) is fixed — changing it would be
 * a different set, and "move" is a create + delete the person should do on purpose.
 */
export default function SlabEditor({
  draft, options, scopes, existingSets, gst, onCancel, onChanged, onSaved, onError,
}) {
  const isEdit = draft.mode === 'edit';
  const [scopeType, setScopeType] = useState(draft.scopeType);
  const [stateId, setStateId] = useState(draft.stateId ?? null);
  const [cityIds, setCityIds] = useState(draft.cityIds || []);
  const [vehicle, setVehicle] = useState(draft.vehicle || '');
  const [band, setBand] = useState(draft.band || 'off_peak');
  const [note, setNote] = useState(draft.note || '');
  const [ladder, setLadder] = useState(draft.ladder || blankLadder());

  const initialSig = useRef(ladderSignature(draft.ladder || blankLadder()));
  const initialNote = useRef(draft.note || '');
  const sig = ladderSignature(ladder);
  const touched = sig !== initialSig.current;
  const dirty = touched || note !== initialNote.current;

  const check = useMemo(() => validateLadder(ladder), [ladder]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  // ── Live preview: the backend runs the real engine over this ladder ───────
  const [prev, setPrev] = useState({ loading: false, data: null, error: '' });
  const reqId = useRef(0);
  useEffect(() => {
    if (!vehicle || !check.ok) { setPrev({ loading: false, data: null, error: '' }); return undefined; }
    const id = ++reqId.current;
    setPrev(p => ({ ...p, loading: true, error: '' }));
    const t = setTimeout(async () => {
      try {
        const res = await previewSlabRules({
          scope: 'global', scope_id: null, vehicle_type: vehicle, band,   // scope does not change the maths
          rows: ladderToRules(ladder), km_list: previewKms(ladder),
        });
        if (id === reqId.current) setPrev({ loading: false, data: res.data?.data || null, error: '' });
      } catch (err) {
        if (id === reqId.current) setPrev({ loading: false, data: null, error: errorText(err) });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, vehicle, band, check.ok]);

  // ── Where it will be saved ────────────────────────────────────────────────
  const targets = useMemo(() => {
    if (isEdit) return [{ scope: draft.scope, scope_id: draft.scope_id ?? null, name: draft.scopeName }];
    if (scopeType === 'global') return [{ scope: 'global', scope_id: null, name: 'All cities' }];
    if (scopeType === 'state') {
      const st = (scopes?.states || []).find(s => s.id === stateId);
      return stateId ? [{ scope: 'state', scope_id: stateId, name: st?.name || `State ${stateId}` }] : [];
    }
    const byId = new Map((scopes?.cities || []).map(c => [c.id, c.name]));
    return cityIds.map(id => ({ scope: 'city', scope_id: id, name: byId.get(id) || `City ${id}` }));
  }, [isEdit, draft, scopeType, stateId, cityIds, scopes]);

  const replacing = useMemo(() => {
    if (isEdit || !vehicle) return [];
    const have = new Set((existingSets || []).map(s => s.key));
    return targets.filter(t => have.has(setKeyOf(t.scope, t.scope_id, vehicle, band)));
  }, [isEdit, vehicle, band, targets, existingSets]);

  const canSave = check.ok && vehicle && targets.length > 0 && prev.data?.valid !== false && !prev.loading && (!isEdit || dirty);

  const copyFrom = (key) => {
    const s = (existingSets || []).find(x => x.key === key);
    if (s) setLadder(rulesToLadder(s.rows));
  };

  const save = async () => {
    setSaving(true);
    setLocalError('');
    const rows = ladderToRules(ladder);
    const done = [];
    const failed = [];
    let worst = null;
    for (const t of targets) {
      try {
        const res = await saveSlabSet({
          scope: t.scope, scope_id: t.scope_id, vehicle_type: vehicle, band,
          note: note.trim() || null, rows,
        });
        done.push(t.name);
        const c = res.data?.data?.cache;
        if (!worst || (c && c.all_servers === false)) worst = res;
      } catch (err) {
        failed.push(`${t.name}: ${errorText(err)}`);
      }
    }
    setSaving(false);
    if (done.length) {
      const label = done.length === 1 ? done[0] : `${done.length} cities`;
      if (failed.length === 0) {
        onSaved(worst, `Slabs saved for ${label}`);
        return;
      }
      onChanged();            // some sets are live — refresh the list behind this screen
    }
    setLocalError(`${failed.length} of ${targets.length} could not be saved — ${failed.join(' · ')}`);
    onError?.('Some slab sets could not be saved');
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved slab changes?')) return;
    onCancel();
  };

  const vehicleOptions = options?.vehicle_types || [];
  const bandOptions = (options?.bands || ['off_peak', 'peak', 'night']).map(b => ({ value: b, label: BAND_LABEL[b] || b }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={cancel}>Back to slabs</Button>
        <h3 className="text-base font-bold text-accent-navy">
          {isEdit ? 'Edit slab set' : draft.copyOf ? 'Copy slab set' : 'New slab set'}
        </h3>
        {isEdit && <Badge tone="neutral">{draft.scopeName} · {vehicle} · {BAND_LABEL[band]}</Badge>}
      </div>

      {/* ── 1. Where ──────────────────────────────────────────────────────── */}
      <Card className="space-y-4">
        <CardHeader title="1 · Where and for whom"
                    subtitle={isEdit ? 'The place, vehicle and time band of an existing set cannot be changed.' : 'Pick the cities, the vehicle and the time band these slabs are for.'} />
        {!isEdit && (
          <ScopePicker scopes={scopes} scopeType={scopeType} onScopeType={setScopeType}
                       stateId={stateId} onStateId={setStateId} cityIds={cityIds} onCityIds={setCityIds} />
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Vehicle</label>
            <select value={vehicle} disabled={isEdit} onChange={e => setVehicle(e.target.value)}
                    className={`${field} w-full !py-2 !text-sm`}>
              <option value="">Choose a vehicle…</option>
              {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <Segmented label="Time band" value={band} onChange={setBand} disabled={isEdit} options={bandOptions} />
            <p className="text-[11px] text-ink-faint mt-1.5 leading-relaxed">{BAND_HELP[band]}</p>
          </div>
        </div>

        {replacing.length > 0 && (
          <Alert tone="warning" title="This will replace slabs that already exist">
            {replacing.map(t => t.name).join(', ')} already {replacing.length === 1 ? 'has' : 'have'} a {BAND_LABEL[band]} set
            for {vehicle}. Saving overwrites it.
          </Alert>
        )}
      </Card>

      {/* ── 2. Slabs ──────────────────────────────────────────────────────── */}
      <Card className="space-y-3">
        <CardHeader
          title="2 · Slabs"
          subtitle="A trip is priced by its TOTAL distance: the whole trip is charged at the rates of the slab it falls in (7 km at ₹15 / km = ₹105), not slab by slab."
          right={!isEdit && (existingSets || []).length > 0 && (
            <select className={field} value="" onChange={e => copyFrom(e.target.value)} aria-label="Copy slabs from an existing set">
              <option value="">Copy slabs from…</option>
              {existingSets.map(s => (
                <option key={s.key} value={s.key}>{(s.scope_name || s.scope)} · {s.vehicle_type} · {BAND_LABEL[s.band]}</option>
              ))}
            </select>
          )}
        />

        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-accent-navy text-brand-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Trip distance</th>
                {COMPONENTS.map(c => <th key={c} className="px-3 py-2.5 text-left font-semibold">{COMPONENT_LABEL[c]}</th>)}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ladder.map((row, i) => {
                const last = i === ladder.length - 1;
                const errs = check.rowErrors[row.id];
                const showErr = touched && errs;
                return (
                  <tr key={row.id} className={showErr ? 'bg-red-50/50' : ''}>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="tabular-nums text-ink-muted">{num(row.from) ?? '?'} –</span>
                        <input type="number" min="0" step="0.5" value={row.to}
                               placeholder={last ? 'no limit' : ''} onChange={e => setLadder(l => setSlabEnd(l, row.id, e.target.value))}
                               className={`${numField} ${showErr && errs.some(e => /"to"|open-ended/.test(e)) ? 'border-red-300' : ''}`} />
                        <span className="text-xs text-ink-muted">km</span>
                      </div>
                      {last && (
                        <p className="text-[10px] text-ink-faint mt-1 max-w-[190px] leading-snug">
                          {row.to === '' ? `${kmLabel(row)} use this slab.` : 'Longer trips use the old pricing engine.'}
                        </p>
                      )}
                    </td>
                    {COMPONENTS.map(c => (
                      <td key={c} className="px-3 py-3 align-top">
                        <CellEditor cell={row.cells[c]} disabled={saving}
                                    bad={showErr && !row.cells[c].mode}
                                    onChange={(patch) => setLadder(l => setCell(l, row.id, c, patch))} />
                      </td>
                    ))}
                    <td className="px-2 py-3 align-top text-center">
                      {ladder.length > 1 && (
                        <button type="button" onClick={() => setLadder(l => removeSlab(l, row.id))} disabled={saving}
                                className="p-1.5 rounded-md text-ink-faint hover:text-red-600 hover:bg-red-50 transition" aria-label={`Remove slab ${i + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setLadder(l => addSlab(l))} disabled={saving}>Add slab</Button>
          {touched && check.errors.length > 0 && (
            <ul className="text-[11px] text-amber-700 space-y-0.5">
              {check.errors.slice(0, 3).map((e, i) => <li key={i}>• {e}</li>)}
              {check.errors.length > 3 && <li>• and {check.errors.length - 3} more</li>}
            </ul>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} disabled={saving}
                 placeholder="e.g. Founder sheet, 12 Oct — Go Car off-peak"
                 className={`${field} w-full !py-2 !text-sm`} />
        </div>
      </Card>

      {/* ── 3. Preview ────────────────────────────────────────────────────── */}
      <Card className="space-y-3">
        <CardHeader title="3 · What the rider pays"
                    subtitle="The real fare engine runs over your slabs. Check the edges: the fare should not drop when a trip crosses into the next slab."
                    right={prev.loading && <Loader2 size={14} className="animate-spin text-ink-muted" />} />
        {!vehicle && <p className="text-xs text-ink-faint">Choose a vehicle to see the numbers.</p>}
        {vehicle && !check.ok && <p className="text-xs text-ink-faint">Finish every slab to see the numbers.</p>}
        {prev.error && <Alert tone="danger">{prev.error}</Alert>}
        {vehicle && check.ok && prev.data && (
          <SlabPreviewTable preview={prev.data.preview} gst={gst}
                            errors={prev.data.valid === false ? prev.data.errors : []} />
        )}
      </Card>

      {localError && <Alert tone="danger" onClose={() => setLocalError('')}>{localError}</Alert>}

      <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-gradient-to-t from-white via-white to-transparent flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-ink-muted">
          {targets.length > 1 ? `Will save ${targets.length} sets.` : targets.length === 1 ? `Saves for ${targets[0].name}.` : 'Pick where this applies.'}
          {' '}Takes effect on the next fare quote once pricing mode is on.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" icon={Save} loading={saving} disabled={!canSave} onClick={save}>
            {targets.length > 1 ? `Save ${targets.length} sets` : 'Save slabs'}
          </Button>
        </div>
      </div>
    </div>
  );
}

