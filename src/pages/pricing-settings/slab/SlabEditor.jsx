import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Sparkles, Pencil, SlidersHorizontal } from 'lucide-react';
import { Button, Card, CardHeader, Badge, Alert } from '../../../components/ui';
import Segmented from './Segmented.jsx';
import ScopePicker from './ScopePicker.jsx';
import SlabPreviewTable from './SlabPreviewTable.jsx';
import { previewSlabRules, saveSlabSet } from '../../../api/opsApi.js';
import {
  COMPONENTS, COMPONENT_LABEL, FLOOR, FLOOR_OPTIONS, FLOOR_HELP, usesAdvanced,
  BAND_LABEL, BAND_HELP, MODE_OPTIONS, TEMPLATES, kmLabel, num, money,
  addSlab, removeSlab, setSlabEnd, setCell, validateLadder, ladderToRules,
  rulesToLadder, ladderSignature, previewKms, blankLadder,
  sampleKm, cellAmount, rowRiderTotal, existingTargets, precedenceNotes,
} from './slabModel.js';

const field = 'bg-white rounded-lg border border-line px-2 py-1.5 text-xs focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60';
const numField = `${field} w-20 tabular-nums text-right`;

const errorText = (err) => err.response?.data?.message
  || err.response?.data?.errors?.[0]?.message
  || err.message
  || 'Something went wrong';

// One cell of the table: HOW this part is charged for this distance range, and
// — right underneath — what that works out to in rupees, so nobody has to do the
// sum in their head to know whether they typed the right thing.
function CellEditor({ cell, km, vehicleBase, onChange, disabled, bad, advanced = false }) {
  const ring = bad ? 'border-red-300' : '';
  const amount = cellAmount(cell, km, vehicleBase);

  let result = null;
  if (cell.mode === 'percent' && amount !== null) result = `= ${money(amount)}`;
  if (cell.mode === 'per_km' && amount !== null) result = `= ${money(amount)} for a ${km} km trip`;

  return (
    <div className="space-y-1 min-w-[170px]">
      <select value={cell.mode} disabled={disabled} onChange={e => onChange({ mode: e.target.value })}
              className={`${field} w-full ${ring}`}>
        {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {(cell.mode === 'fixed' || cell.mode === 'per_km') && (
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          ₹
          <input type="number" min="0" step="0.5" value={cell.value} disabled={disabled}
                 onChange={e => onChange({ value: e.target.value })} className={`${numField} ${ring}`} />
          {cell.mode === 'per_km' && <span>per km</span>}
        </div>
      )}

      {advanced && cell.mode === 'per_km' && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            add / take off ₹
            <input type="number" step="0.5" value={cell.offset ?? ''} disabled={disabled} placeholder="0"
                   title="Fare = rate × km + this amount. Leave 0 unless you need it."
                   onChange={e => onChange({ offset: e.target.value })} className={`${numField} w-20`} />
          </div>
          <p className="text-[10px] text-ink-faint leading-snug max-w-[200px]">
            Fare = rate × km + this amount (use a minus for a deduction). Leave 0 normally.
          </p>
        </div>
      )}

      {cell.mode === 'percent' && (
        <div className="flex items-center gap-1 text-xs text-ink-muted flex-wrap">
          <input type="number" min="0" step="0.5" value={cell.value} disabled={disabled}
                 onChange={e => onChange({ value: e.target.value })} className={`${numField} w-16 ${ring}`} />
          % of ₹
          <input type="number" min="0" step="1" value={cell.ref} disabled={disabled}
                 placeholder={vehicleBase ? `${vehicleBase}` : 'base fare'}
                 title="Leave empty to use the vehicle's own base fare"
                 onChange={e => onChange({ ref: e.target.value })} className={`${numField} w-20 placeholder:text-ink-faint`} />
        </div>
      )}

      {result && <p className="text-[11px] font-semibold text-accent-navy">{result}</p>}
      {cell.mode === 'percent' && cell.ref === '' && vehicleBase && (
        <p className="text-[10px] text-ink-faint leading-snug">of the vehicle&rsquo;s base fare (₹{vehicleBase})</p>
      )}
    </div>
  );
}

// The optional "minimum fare" part of a slab. "No minimum" is a normal choice.
function FloorEditor({ cell, onChange, disabled, bad }) {
  return (
    <div className="space-y-1 min-w-[150px]">
      <select value={cell.mode === 'fixed' ? 'fixed' : 'none'} disabled={disabled}
              onChange={e => onChange({ mode: e.target.value })} className={`${field} w-full`}>
        {FLOOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {cell.mode === 'fixed' && (
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          ₹
          <input type="number" min="0" step="0.5" value={cell.value} disabled={disabled}
                 onChange={e => onChange({ value: e.target.value })} className={`${numField} ${bad ? 'border-red-300' : ''}`} />
        </div>
      )}
    </div>
  );
}

/**
 * Create / edit / copy a slab set.
 *
 * draft: { mode: 'create' | 'edit', scopeType, stateId, cityIds, vehicle, band, note, ladder }
 * In edit mode the target (place, vehicle, band) is fixed — changing it would be
 * a different set, and "move" is a create + remove the person should do on purpose.
 */
export default function SlabEditor({
  draft, options, scopes, existingSets, gst, vehicleBaseFares, onCancel, onChanged, onSaved, onError, onEditExisting,
}) {
  const isEdit = draft.mode === 'edit';
  const [scopeType, setScopeType] = useState(draft.scopeType);
  const [stateId, setStateId] = useState(draft.stateId ?? null);
  const [cityIds, setCityIds] = useState(draft.cityIds || []);
  const [vehicle, setVehicle] = useState(draft.vehicle || '');
  const [band, setBand] = useState(draft.band || 'off_peak');
  const [note, setNote] = useState(draft.note || '');
  const [ladder, setLadder] = useState(draft.ladder || blankLadder());
  const [replaceOk, setReplaceOk] = useState(false);
  // Minimum fare and the ₹ added to a per-km rate are rarely needed; they stay out of the way
  // unless this set already uses them (a set converted from the old pricing does).
  const [advanced, setAdvanced] = useState(() => usesAdvanced(draft.ladder || blankLadder()));

  const initialSig = useRef(ladderSignature(draft.ladder || blankLadder()));
  const initialNote = useRef(draft.note || '');
  const sig = ladderSignature(ladder);
  const touched = sig !== initialSig.current;
  const dirty = touched || note !== initialNote.current;

  const check = useMemo(() => validateLadder(ladder), [ladder]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  // The list behind this screen can be long and scrolled far down. Opening an editor
  // from there must start at its TOP — otherwise the person lands halfway down the
  // slab table and the "where" section is off-screen above them.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, []);

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

  // Places that ALREADY have slabs for this vehicle + band. Saving over them deletes
  // the old slabs completely, so it is never the default: the person either opens the
  // existing set to edit it, or ticks a box saying they mean to replace it.
  const clashes = useMemo(
    () => (isEdit || !vehicle ? [] : existingTargets(targets, existingSets, vehicle, band)),
    [isEdit, vehicle, band, targets, existingSets],
  );
  useEffect(() => { setReplaceOk(false); }, [vehicle, band, scopeType, stateId, cityIds]);

  const notes = useMemo(
    () => (isEdit ? [] : precedenceNotes({ targets, existingSets, vehicle, band, cities: scopes?.cities || [] })),
    [isEdit, targets, existingSets, vehicle, band, scopes],
  );

  const vehicleBase = vehicle ? (vehicleBaseFares?.[vehicle] ?? prev.data?.vehicle_base_fare ?? null) : null;

  const canSave = check.ok && vehicle && targets.length > 0 && prev.data?.valid !== false
    && !prev.loading && (!isEdit || dirty) && (clashes.length === 0 || replaceOk);

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

  const editExisting = (set) => {
    if (dirty && !window.confirm('Discard what you entered and open the existing slabs instead?')) return;
    onEditExisting?.(set);
  };

  const vehicleOptions = options?.vehicle_types || [];
  const bandOptions = (options?.bands || ['off_peak', 'peak', 'night']).map(b => ({ value: b, label: BAND_LABEL[b] || b }));
  const showTemplates = !isEdit && !touched && !draft.copyOf;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={cancel}>Back to slabs</Button>
        <h3 className="text-base font-bold text-accent-navy">
          {isEdit ? 'Edit slab set' : draft.copyOf ? 'Copy slab set' : 'New slab set'}
        </h3>
        {isEdit && <Badge tone="neutral">{draft.scopeName} · {vehicle} · {BAND_LABEL[band]}</Badge>}
      </div>

      <Alert tone="info" title="How slabs work">
        Each trip belongs to <strong>one slab</strong>, chosen by the trip&rsquo;s <strong>total km</strong>, and the
        <strong> whole trip</strong> is charged at that slab&rsquo;s rates. Example: a 7 km trip in a 5–10 km slab at
        ₹15 per km pays ₹105 distance fare. The rider pays base fare + distance fare + convenience fee, plus GST.
      </Alert>

      {/* ── 1. Where ──────────────────────────────────────────────────────── */}
      <Card className="space-y-4">
        <CardHeader title="1 · Where and for whom"
                    subtitle={isEdit ? 'The place, vehicle and time band of an existing set cannot be changed.' : 'Pick the cities, the vehicle and the time band these slabs are for.'} />
        {!isEdit && (
          <ScopePicker scopes={scopes} scopeType={scopeType} onScopeType={setScopeType}
                       stateId={stateId} onStateId={setStateId} cityIds={cityIds} onCityIds={setCityIds}
                       autoFocusSearch={cityIds.length === 0} />
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

        {clashes.length > 0 && (
          <Alert tone="warning" title={`${clashes.map(c => c.target.name).join(', ')} already ${clashes.length === 1 ? 'has' : 'have'} ${BAND_LABEL[band]} slabs for ${vehicle}`}>
            <p>A place can only have one set. Saving this will <strong>delete the existing slabs</strong> and use these instead — they are not merged.</p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {clashes.length === 1 && onEditExisting && (
                <Button variant="outline" size="sm" icon={Pencil} onClick={() => editExisting(clashes[0].set)}>
                  Edit the existing slabs instead
                </Button>
              )}
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={replaceOk} onChange={e => setReplaceOk(e.target.checked)} className="accent-accent-navy" />
                Replace the existing slabs
              </label>
            </div>
          </Alert>
        )}

        {notes.map((n, i) => <Alert key={i} tone="info">{n}</Alert>)}
      </Card>

      {/* ── 2. Slabs ──────────────────────────────────────────────────────── */}
      <Card className="space-y-3">
        <CardHeader
          title="2 · Slabs"
          subtitle="One row per distance range. For each part, say how it is charged — the rupee result is shown right under it."
          right={!isEdit && (existingSets || []).length > 0 && (
            <select className={field} value="" onChange={e => copyFrom(e.target.value)} aria-label="Copy slabs from an existing set">
              <option value="">Copy slabs from…</option>
              {existingSets.map(s => (
                <option key={s.key} value={s.key}>{(s.scope_name || s.scope)} · {s.vehicle_type} · {BAND_LABEL[s.band]}</option>
              ))}
            </select>
          )}
        />

        {showTemplates && (
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-dashed border-brand-500 bg-brand-100/50 px-3 py-2">
            <Sparkles size={14} className="text-brand-700 shrink-0" />
            <span className="text-xs text-ink-muted">Start from an example:</span>
            {TEMPLATES.map(t => (
              <button key={t.id} type="button" title={t.hint}
                      onClick={() => setLadder(t.build())}
                      className="text-xs font-semibold text-accent-navy bg-white border border-line hover:border-accent-navy rounded-full px-3 py-1 transition">
                {t.label}
              </button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-ink-faint leading-relaxed">
          <strong>Flat amount</strong> = same for every trip in the slab · <strong>Rate per km</strong> = rate × trip km ·
          <strong> Percentage</strong> = % of an amount you enter (empty = the vehicle&rsquo;s base fare) ·
          <strong> Not charged</strong> = ₹0.
        </p>

        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-accent-navy text-brand-400 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Trip distance</th>
                {COMPONENTS.map(c => <th key={c} className="px-3 py-2.5 text-left font-semibold">{COMPONENT_LABEL[c]}</th>)}
                {advanced && <th className="px-3 py-2.5 text-left font-semibold" title={FLOOR_HELP}>{COMPONENT_LABEL[FLOOR]} (optional)</th>}
                <th className="px-3 py-2.5 text-left font-semibold">Rider pays ≈</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ladder.map((row, i) => {
                const last = i === ladder.length - 1;
                const errs = check.rowErrors[row.id];
                const showErr = touched && errs;
                const km = sampleKm(row);
                const total = rowRiderTotal(row, gst, vehicleBase);
                return (
                  <React.Fragment key={row.id}>
                    <tr className={showErr ? 'bg-red-50/50' : ''}>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="tabular-nums text-ink-muted">{num(row.from) ?? '?'} –</span>
                          <input type="number" min="0" step="0.5" value={row.to} aria-label={`Slab ${i + 1} ends at km`}
                                 placeholder={last ? 'no limit' : ''} onChange={e => setLadder(l => setSlabEnd(l, row.id, e.target.value))}
                                 className={`${numField} ${showErr && errs.some(e => /"to"|open-ended/.test(e)) ? 'border-red-300' : ''}`} />
                          <span className="text-xs text-ink-muted">km</span>
                        </div>
                        {last && (
                          <p className="text-[10px] text-ink-faint mt-1 max-w-[190px] leading-snug whitespace-normal">
                            {row.to === '' ? `${kmLabel(row)} use this slab.` : 'Longer trips use the old pricing engine.'}
                          </p>
                        )}
                      </td>
                      {COMPONENTS.map(c => (
                        <td key={c} className="px-3 py-3 align-top">
                          <CellEditor cell={row.cells[c]} km={km} vehicleBase={vehicleBase} disabled={saving}
                                      advanced={advanced}
                                      bad={showErr && !row.cells[c].mode}
                                      onChange={(patch) => setLadder(l => setCell(l, row.id, c, patch))} />
                        </td>
                      ))}
                      {advanced && (
                        <td className="px-3 py-3 align-top">
                          <FloorEditor cell={row.cells[FLOOR] || { mode: 'none', value: '' }} disabled={saving}
                                       bad={showErr && errs.some(e => /inimum fare/.test(e))}
                                       onChange={(patch) => setLadder(l => setCell(l, row.id, FLOOR, patch))} />
                        </td>
                      )}
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        {total ? (
                          <>
                            <div className="font-bold tabular-nums text-accent-navy">{money(total.total)}</div>
                            <div className="text-[10px] text-ink-faint">for a {total.km} km trip, with GST</div>
                          </>
                        ) : <span className="text-xs text-ink-faint">fill every part</span>}
                      </td>
                      <td className="px-2 py-3 align-top text-center">
                        {ladder.length > 1 && (
                          <button type="button" onClick={() => setLadder(l => removeSlab(l, row.id))} disabled={saving}
                                  className="p-1.5 rounded-md text-ink-faint hover:text-red-600 hover:bg-red-50 transition" aria-label={`Remove slab ${i + 1}`}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {showErr && (
                      <tr className="bg-red-50/50">
                        <td colSpan={COMPONENTS.length + 3 + (advanced ? 1 : 0)} className="px-3 pb-2.5 text-[11px] text-red-700">
                          {errs.join(' ')}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={Plus} onClick={() => setLadder(l => addSlab(l))} disabled={saving}>
            Add another slab
          </Button>
          <Button variant="ghost" size="sm" icon={SlidersHorizontal}
                  onClick={() => setAdvanced(a => !a)} disabled={saving && advanced}
                  title="Minimum fare, and a fixed ₹ added to a per-km rate">
            {advanced ? 'Hide' : 'Show'} advanced options
          </Button>
        </div>
        {advanced && (
          <p className="text-[11px] text-ink-faint leading-relaxed">
            <strong>Minimum fare</strong>: the ride fare never goes below this (applied after surge). <strong>add / take off ₹</strong> on a per-km
            rate: a fixed amount added to rate × km, e.g. ₹16/km − ₹10 reproduces &ldquo;₹15 for the first 10 km, ₹16 after&rdquo;.
          </p>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} disabled={saving}
                 placeholder="e.g. Founder sheet, 12 Oct — Go Car off-peak"
                 className={`${field} w-full !py-2 !text-sm`} />
        </div>
      </Card>

      {/* ── 3. Preview ────────────────────────────────────────────────────── */}
      <Card className="space-y-3">
        <CardHeader title="3 · Check the numbers"
                    subtitle="The real fare engine runs over your slabs. Look at the edges: the fare should not drop when a trip crosses into the next slab."
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
          {clashes.length > 0 && !replaceOk ? ' Tick “Replace the existing slabs” to continue.' : ''}
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
