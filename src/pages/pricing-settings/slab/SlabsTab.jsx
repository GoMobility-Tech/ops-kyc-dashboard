import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Plus, RefreshCw, Settings2, ShieldCheck, FlaskConical, PowerOff } from 'lucide-react';
import { Alert, Button, Card, CardHeader, EmptyState, Modal, Spinner, Badge } from '../../../components/ui';
import { getSlabRules, getSlabCoverage, getSlabScopes, deleteSlabSet } from '../../../api/opsApi.js';
import { describeFailure } from '../pricingMeta.js';
import SlabSetCard from './SlabSetCard.jsx';
import SlabEditor from './SlabEditor.jsx';
import Segmented from './Segmented.jsx';
import { BAND_LABEL, SCOPE_LABEL, rulesToLadder, blankLadder } from './slabModel.js';

const field = 'bg-white rounded-lg border border-line px-3 py-1.5 text-xs focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20';

const FLAG_UI = {
  on:     { tone: 'success', icon: ShieldCheck,  title: 'Slab pricing is ON', text: 'Where a set exists, riders are charged from it. Everywhere else the old engine is used.' },
  shadow: { tone: 'info',    icon: FlaskConical, title: 'Slab pricing is in SHADOW mode', text: 'Riders are still charged by the old engine. Slabs only run alongside it so the difference can be compared.' },
  off:    { tone: 'warning', icon: PowerOff,     title: 'Slab pricing is OFF', text: 'You can create and edit slabs now, but no ride is priced from them until the mode is changed to Shadow or On.' },
};

const errorText = (err) => err.response?.data?.message || err.message || 'Something went wrong';

// ─── Distance slabs ─────────────────────────────────────────────────────────
//
// Founder-editable pricing rules: "for trips of x to y km in <city>, charge
// <base> + <distance> + <convenience fee> like this". Everything the screen
// offers is the backend's own model — the vehicle list, the bands and the
// modes come from the API, and a set is only ever saved whole (the backend
// validates it and replaces it atomically).
export default function SlabsTab({ gst, onSaved, onError, onGoSettings }) {
  const [state, setState] = useState({ loading: true, failure: '', sets: [], flag: null, options: null, coverage: null, scopes: null, scopesFailure: '' });
  const [view, setView] = useState(null);           // null = list, otherwise an editor draft
  const [filter, setFilter] = useState({ vehicle: '', band: '' });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const [rules, coverage, scopes] = await Promise.allSettled([getSlabRules(), getSlabCoverage(), getSlabScopes()]);
    const d = (r) => (r.status === 'fulfilled' ? r.value.data?.data : null);
    setState({
      loading: false,
      failure: describeFailure(rules) || '',
      sets: d(rules)?.sets || [],
      flag: d(rules)?.flag || null,
      options: d(rules)?.options || null,
      coverage: d(coverage)?.matrix || null,
      scopes: d(scopes),
      scopesFailure: describeFailure(scopes) || '',
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const { sets, flag, options, coverage, scopes } = state;

  const visible = useMemo(() => sets.filter(s =>
    (!filter.vehicle || s.vehicle_type === filter.vehicle) && (!filter.band || s.band === filter.band)),
  [sets, filter]);

  // ── Editor drafts ─────────────────────────────────────────────────────────
  const openNew = () => setView({
    mode: 'create', scopeType: 'city', stateId: null, cityIds: [],
    vehicle: filter.vehicle || '', band: filter.band || 'off_peak', note: '', ladder: blankLadder(),
  });
  const openEdit = (s) => setView({
    mode: 'edit', scope: s.scope, scope_id: s.scope_id, scopeName: s.scope === 'global' ? 'All cities' : (s.scope_name || `${SCOPE_LABEL[s.scope]} ${s.scope_id}`),
    vehicle: s.vehicle_type, band: s.band, note: s.note || '', ladder: rulesToLadder(s.rows),
  });
  const openCopy = (s) => setView({
    mode: 'create', copyOf: s.key, scopeType: 'city', stateId: null, cityIds: [],
    vehicle: s.vehicle_type, band: s.band, note: s.note || '', ladder: rulesToLadder(s.rows),
  });

  const saved = (res, message) => {
    onSaved?.(res, message);
    setView(null);
    load();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const s = toDelete;
      const res = await deleteSlabSet({
        scope: s.scope, ...(s.scope_id != null ? { scope_id: s.scope_id } : {}),
        vehicle_type: s.vehicle_type, band: s.band,
      });
      onSaved?.(res, `Slabs removed for ${s.scope_name || SCOPE_LABEL[s.scope]}`);
      setToDelete(null);
      load();
    } catch (err) {
      onError?.(errorText(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (state.loading && sets.length === 0 && !view) return <div className="py-16 flex justify-center"><Spinner /></div>;

  if (state.failure) {
    return (
      <Alert tone="danger" title="Slabs did not load">
        {state.failure}
        <span className="block mt-1 opacity-80">
          If this says the table does not exist, the slab migration has not been applied on this environment yet.
        </span>
      </Alert>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  if (view) {
    return (
      <>
        {state.scopesFailure && <Alert tone="warning" className="mb-3">Cities could not be loaded ({state.scopesFailure}). You can still pick “All cities”.</Alert>}
        <SlabEditor
          key={view.copyOf || view.scope_id || 'new'}
          draft={view} options={options} scopes={scopes} existingSets={sets} gst={gst}
          onCancel={() => setView(null)} onChanged={load} onSaved={saved} onError={onError}
        />
      </>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  const fl = FLAG_UI[flag?.mode] || FLAG_UI.off;
  const FlagIcon = fl.icon;
  const vehicleChoices = [{ value: '', label: 'All vehicles' }, ...((options?.vehicle_types || []).map(v => ({ value: v, label: v })))];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-accent-navy">Distance slabs</h3>
          <p className="text-xs text-ink-muted mt-0.5 max-w-2xl leading-relaxed">
            Set the base fare, distance fare and convenience fee for each range of trip distance, per city,
            vehicle and time of day. A trip is charged at the rates of the slab its total distance falls in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load} loading={state.loading}>Refresh</Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={openNew}>New slab set</Button>
        </div>
      </div>

      <Alert tone={fl.tone} title={fl.title}>
        <span className="inline-flex items-start gap-1.5"><FlagIcon size={12} className="mt-0.5 shrink-0" />{fl.text}</span>
        {flag?.mode !== 'on' && onGoSettings && (
          <button type="button" onClick={onGoSettings} className="mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
            <Settings2 size={12} /> Open Settings → Slab Pricing
          </button>
        )}
      </Alert>

      {coverage && coverage.length > 0 && (
        <Card padding="sm">
          <CardHeader title="Coverage" subtitle="Where slabs exist. Anything not covered is priced by the old engine." className="px-1 pb-2" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-ink-muted">
                  <th className="text-left font-semibold px-2 py-1.5">Vehicle</th>
                  {Object.keys(BAND_LABEL).map(b => <th key={b} className="text-left font-semibold px-2 py-1.5">{BAND_LABEL[b]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {coverage.map(row => (
                  <tr key={row.vehicle_type}>
                    <td className="px-2 py-1.5 font-semibold capitalize text-ink">{row.vehicle_type}</td>
                    {row.bands.map(b => (
                      <td key={b.band} className="px-2 py-1.5">
                        {b.global
                          ? <Badge tone="success">All cities</Badge>
                          : (b.city_sets || b.state_sets)
                            ? <Badge tone="navy">{[b.city_sets ? `${b.city_sets} ${b.city_sets === 1 ? 'city' : 'cities'}` : '', b.state_sets ? `${b.state_sets} ${b.state_sets === 1 ? 'state' : 'states'}` : ''].filter(Boolean).join(' + ')}</Badge>
                            : <span className="text-ink-faint">Old engine</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Vehicle</label>
          <select className={field} value={filter.vehicle} onChange={e => setFilter(f => ({ ...f, vehicle: e.target.value }))}>
            {vehicleChoices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <Segmented
          label="Time band" value={filter.band} onChange={(band) => setFilter(f => ({ ...f, band }))}
          options={[{ value: '', label: 'All' }, ...Object.keys(BAND_LABEL).map(b => ({ value: b, label: BAND_LABEL[b] }))]}
        />
        <span className="text-xs text-ink-faint pb-2">{visible.length} of {sets.length} {sets.length === 1 ? 'set' : 'sets'}</span>
      </div>

      {sets.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No slabs yet"
          description="Every city is priced by the old engine. Create a slab set to price a vehicle by trip distance in the cities you choose."
          action={<Button variant="primary" size="sm" icon={Plus} onClick={openNew}>Create the first slab set</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Layers} title="Nothing matches this filter" description="Try All vehicles or All time bands." />
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <SlabSetCard key={s.key} set={s} gst={gst} onEdit={openEdit} onCopy={openCopy} onDelete={setToDelete} />
          ))}
        </div>
      )}

      <Modal
        open={!!toDelete} onClose={() => !deleting && setToDelete(null)} size="sm"
        title="Remove this slab set?"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setToDelete(null)} disabled={deleting}>Keep it</Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>Remove</Button>
          </div>
        )}
      >
        {toDelete && (
          <p className="text-sm text-ink leading-relaxed">
            <strong>{toDelete.scope === 'global' ? 'All cities' : (toDelete.scope_name || toDelete.scope)}</strong>
            {' · '}<span className="capitalize">{toDelete.vehicle_type}</span>{' · '}{BAND_LABEL[toDelete.band]}.
            <span className="block mt-2 text-ink-muted text-xs">
              Rides there go back to the next level up (state, then all cities) or to the old engine. The change is
              recorded in History and applies to the next fare quote.
            </span>
          </p>
        )}
      </Modal>
    </div>
  );
}

