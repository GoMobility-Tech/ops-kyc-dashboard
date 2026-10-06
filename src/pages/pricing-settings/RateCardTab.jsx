import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, RefreshCw, Clock, MapPin, Hash, Info, Moon, Sun, Zap } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, JsonViewer, Spinner, Tabs } from '../../components/ui';
import { getPricingRateCard } from '../../api/opsApi.js';

// ─── Rate Card ───────────────────────────────────────────────────────────────
//
// A PREVIEW of what drivers see in the app (contract: backend docs/41). It is
// built by the same backend code the driver app calls, so this screen cannot
// drift from the app: change a rate in Vehicles/Settings, come back here, and
// this is the card the driver gets.
//
// Read-only on purpose. Editing stays in the other tabs; this tab answers
// "what will a driver actually see if I save this?".
//
// Two views of one response:
//   left   — the card exactly as the driver app renders it (phone width)
//   right  — what the app does not show: the time bands, the earnings
//            examples, and the raw JSON the app receives

const BAND_ICON = { off_peak: Sun, peak: Zap, night: Moon };
const BAND_TONE = {
  off_peak: 'border-green-200 bg-green-50',
  peak:     'border-amber-200 bg-amber-50',
  night:    'border-blue-200 bg-blue-50',
};
const SECTION_TONE = {
  green:  'bg-green-50 text-green-800 border-green-200',
  teal:   'bg-teal-50 text-teal-800 border-teal-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
};
const money = (n) => `₹${Number(n).toFixed(2).replace(/\.00$/, '')}`;
const windowsText = (ws = []) => ws.map(w => `${w.from}–${w.to}`).join(', ');

// ─── One row, as the driver sees it ─────────────────────────────────────────
function Row({ row, nowBand, bands }) {
  const keys = row.perBand ? bands.map(b => b.key).filter(k => row.perBand[k]) : [];
  return (
    <div className="px-3 py-2.5 border-t border-line first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink leading-snug">{row.title}</p>
          {row.subtitle && <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{row.subtitle}</p>}
        </div>
        {!row.perBand && (
          <p className="text-[13px] font-bold text-brand-800 whitespace-nowrap text-right">{row.value?.display}</p>
        )}
      </div>

      {row.perBand && (
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }}>
          {keys.map((k) => {
            const b = bands.find(x => x.key === k);
            const active = k === nowBand;
            return (
              <div key={k}
                   className={`rounded-lg border px-2 py-1.5 text-center
                     ${active ? 'border-brand-600 bg-brand-100' : 'border-line bg-white'}`}>
                <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">{b?.label || k}</p>
                <p className="text-[13px] font-bold text-ink mt-0.5">{row.perBand[k].display}</p>
              </div>
            );
          })}
        </div>
      )}

      {row.slabs && (
        <div className="mt-2 rounded-lg border border-line bg-white divide-y divide-line">
          {row.slabs.map((s) => (
            <div key={s.display} className="flex justify-between px-2.5 py-1.5 text-[12px]">
              <span className="text-ink-muted">{s.display}</span>
              <span className="font-semibold text-ink">{s.rate.display}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── The card (left pane) ───────────────────────────────────────────────────
function DriverCard({ card }) {
  const nowBand = card.now?.band;
  return (
    <div>
      <div className="px-3 py-2 bg-accent-navy text-white rounded-t-xl">
        <p className="text-[10px] uppercase tracking-wider text-brand-400 font-semibold">Rate Card</p>
        <p className="text-sm font-bold">
          {card.now?.label || '—'} now{card.now?.until ? <span className="font-normal opacity-80"> · until {card.now.until}</span> : null}
        </p>
      </div>
      {card.categoryNotes && (
        <p className="px-3 py-1.5 text-[11px] bg-amber-50 text-amber-800 border-b border-amber-200">{card.categoryNotes}</p>
      )}
      {card.sections.map((s) => (
        <div key={s.key}>
          <div className={`px-3 py-1.5 text-[12px] font-bold border-y ${SECTION_TONE[s.tone] || SECTION_TONE.green}`}>
            {s.title}
          </div>
          {s.rows.map((r) => <Row key={r.key} row={r} nowBand={nowBand} bands={card.bands} />)}
        </div>
      ))}
    </div>
  );
}

// ─── Bands (right pane) ─────────────────────────────────────────────────────
function Bands({ card }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {card.bands.map((b) => {
        const Icon = BAND_ICON[b.key] || Clock;
        const active = b.key === card.now?.band;
        return (
          <div key={b.key}
               className={`rounded-xl border p-3 ${BAND_TONE[b.key] || 'border-line bg-surface-alt'}
                 ${active ? 'ring-2 ring-brand-600' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink inline-flex items-center gap-1.5"><Icon size={13} /> {b.label}</p>
              {active && <Badge tone="brand">now</Badge>}
            </div>
            <p className="text-[13px] font-bold text-accent-navy mt-1.5">{b.summary}</p>
            <p className="text-[11px] text-ink-muted mt-1 tabular-nums">{windowsText(b.windows)}</p>
            {b.baseFare?.discountBands && (
              <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                {b.baseFare.discountBands.map(x =>
                  `${x.upToKm ? `up to ${x.upToKm} km` : 'beyond'} ${x.discountPct}%`).join(' · ')}
              </p>
            )}
            {b.note && <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">{b.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Earnings examples (right pane) ─────────────────────────────────────────
function Examples({ card }) {
  const bands = card.bands;
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="bg-surface-alt text-ink-muted">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Trip</th>
              {bands.map(b => <th key={b.key} className="text-right font-semibold px-3 py-2">{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {card.examples.map((e) => (
              <tr key={e.distanceKm} className="border-t border-line">
                <td className="px-3 py-2 font-semibold text-ink whitespace-nowrap">{e.distanceKm} km</td>
                {bands.map((b) => {
                  const x = e.bands[b.key];
                  if (!x) return <td key={b.key} className="px-3 py-2 text-right text-ink-faint">—</td>;
                  return (
                    <td key={b.key} className="px-3 py-2 text-right align-top">
                      <span className="font-bold text-ink tabular-nums">{money(x.youEarn)}</span>
                      {x.minimumFareApplied && <span className="text-amber-700 font-bold" title="Minimum fare applied"> *</span>}
                      <span className="block text-[10px] text-ink-faint tabular-nums mt-0.5">
                        {money(x.rideFare)} − {money(x.platformFee)} − {money(x.gstOnPlatformFee)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-muted mt-1.5 leading-relaxed">
        <b>You earn</b> = ride fare − platform fee − GST on it. <b className="text-amber-700">*</b> minimum fare applied.
        {' '}{card.disclaimer}
      </p>
    </div>
  );
}

// ─── Presentational view — takes a response, renders it (smoke-tested) ───────
export function RateCardView({ response, onSelectTab, selecting = false }) {
  const tabs = (response?.tabs || []).map(t => ({
    value: t.vehicleType,
    label: t.disabled ? `${t.displayName} · not in zone` : t.displayName,
  }));

  if (!response) return null;

  if (tabs.length === 0) {
    return <Alert tone="info" title="No categories">{response.emptyReason || 'Nothing to show.'}</Alert>;
  }

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={response.selected} onChange={onSelectTab} size="sm" />

      {!response.card ? (
        <Alert tone="info" title="No card for this category">{response.emptyReason || 'Not available.'}</Alert>
      ) : (
        <div className={`grid gap-4 lg:grid-cols-5 ${selecting ? 'opacity-60' : ''}`}>
          {/* Driver app preview */}
          <div className="lg:col-span-2 min-w-0">
            <p className="text-[11px] text-ink-muted font-semibold mb-1.5 inline-flex items-center gap-1.5">
              <Smartphone size={12} /> What the driver sees
            </p>
            <div className="rounded-2xl border-2 border-line-strong bg-surface-soft shadow-card overflow-hidden">
              <DriverCard card={response.card} />
            </div>
          </div>

          {/* Ops detail */}
          <div className="space-y-4 min-w-0 lg:col-span-3">
            <Card>
              <CardHeader title="How the fare changes with time"
                subtitle="Night wins over peak, peak wins over off-peak. Peak also happens in any hour when demand or weather is high." />
              <div className="mt-3"><Bands card={response.card} /></div>
            </Card>

            <Card>
              <CardHeader title="What the driver earns"
                subtitle="Worked out by the real fare engine, not a separate formula." />
              <div className="mt-3"><Examples card={response.card} /></div>
            </Card>

            <JsonViewer label="Raw response (what the app receives)" data={response} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Container — fetches, owns the preview controls ─────────────────────────
export default function RateCardTab() {
  const [vehicleType, setVehicleType] = useState('');
  const [zoneId, setZoneId]           = useState('');
  const [at, setAt]                   = useState('');        // '' = now
  const [response, setResponse]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [failure, setFailure]         = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;                              // ignore out-of-order replies
    setLoading(true);
    try {
      const params = {};
      if (vehicleType) params.vehicleType = vehicleType;
      if (zoneId !== '') params.zoneId = zoneId;
      if (at) params.at = new Date(at).toISOString();
      const res = await getPricingRateCard(params);
      if (mine !== seq.current) return;
      setResponse(res.data?.data || null);
      setFailure('');
    } catch (err) {
      if (mine !== seq.current) return;
      const status = err.response?.status;
      setFailure(
        status === 403 ? 'Your account is not allowed to open the rate card preview.'
        : status === 404 ? (err.response?.data?.message || 'That zone or category was not found.')
        : status === 422 ? (err.response?.data?.message || 'One of the preview inputs is not valid.')
        : err.response?.data?.message || 'Could not load the rate card.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [vehicleType, zoneId, at]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Zone ID (optional)" type="number" min="1" icon={MapPin}
                 containerClassName="w-40" placeholder="all zones"
                 value={zoneId} onChange={(e) => setZoneId(e.target.value)} />
          <Input label="Preview at (optional)" type="datetime-local" icon={Clock}
                 containerClassName="w-56" value={at}
                 onChange={(e) => setAt(e.target.value)} />
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
          {(zoneId !== '' || at) && (
            <Button variant="outline" size="sm" onClick={() => { setZoneId(''); setAt(''); }}>Reset</Button>
          )}
          {response?.configVersion && (
            <Badge tone="neutral" icon={Hash}>config {response.configVersion}</Badge>
          )}
          {response?.zone && <Badge tone="info" icon={MapPin}>{response.zone.name}</Badge>}
        </div>
        <p className="text-[11px] text-ink-muted mt-2 flex items-start gap-1.5 leading-relaxed">
          <Info size={12} className="shrink-0 mt-0.5" />
          This is the card the driver app gets, built from live pricing. Saved a change in another tab?
          Press Refresh. "Preview at" only changes which band is marked as now.
        </p>
      </Card>

      {failure && <Alert tone="danger" title="Rate card did not load" onClose={() => setFailure('')}>{failure}</Alert>}

      {loading && !response ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : (
        <RateCardView
          response={response}
          selecting={loading}
          onSelectTab={(v) => setVehicleType(v)}
        />
      )}
    </div>
  );
}
