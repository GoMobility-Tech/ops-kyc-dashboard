import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, RefreshCw, Radio, Pause, Users, Car, PowerOff, AlertTriangle,
  Crosshair, ChevronRight, SatelliteDish, Hourglass, MapPinOff, BarChart3,
} from 'lucide-react';
import { getLiveMap, getLiveMapSummary } from '../../api/opsApi.js';
import useUrlFilters from '../../utils/useUrlFilters.js';
import MapView from '../../components/map/MapView.jsx';
import {
  Button, Card, Badge, Select, SearchBar, Alert, Spinner, EmptyState, StatTile,
} from '../../components/ui';
import {
  statusMeta, DISCONNECTED_COLOUR, STATUS_OPTS, VEHICLE_OPTS,
  fmtTime, fmtDur, fmtNum, apiError, isDisconnected, connectionMessage,
} from './metricsMeta.js';
import { StatusPill, ConnectionTag, DutyBadge, PendingOfflineBadge, TestTag, VehicleTypes } from './DriverBits.jsx';
import { glyphForTypes, pinIcon, PIN_PATH } from './vehicleIcon.js';
import ForceOfflineModal, { forceOfflineToast } from './ForceOfflineModal.jsx';

const DEFAULT_FILTERS = { cityId: '', vehicleType: '', status: '', test: '' };

const POLL_MS = 12000;
const MAP_LIMIT = 2000;
const ICON_PIN_LIMIT = 600;

// ─── Live-status header chips ────────────────────────────────────────────────

function SummaryChips({ summary }) {
  const t = summary?.totals || {};
  const quality = [
    { key: 'stale',               label: 'App not responding', value: t.stale,             icon: SatelliteDish, hint: 'Marked online but the app stopped pinging — do not trust these pins' },
    { key: 'withoutLocation',     label: 'No location',      value: t.withoutLocation,     icon: MapPinOff,     hint: 'Online but no location on record — not drawn on the map' },
    { key: 'pendingForceOffline', label: 'Offline pending',  value: t.pendingForceOffline, icon: Hourglass,     hint: 'These drivers go offline as soon as their ride ends' },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label="Available" value={fmtNum(t.available, '—')} icon={Users}   tone="success" />
        <StatTile label="On ride"   value={fmtNum(t.onRide, '—')}    icon={Car}     tone="info" />
        <StatTile label="Total online" value={fmtNum(t.totalOnline, '—')} icon={Radio} tone="navy" />
        <StatTile label="Offline"   value={fmtNum(t.offline, '—')}   icon={PowerOff} tone="neutral" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">Data quality</span>
        {quality.map(q => (
          <span key={q.key} title={q.hint}>
            <Badge tone={q.value > 0 ? 'warning' : 'neutral'} icon={q.icon}>
              {q.label}: {fmtNum(q.value, '0')}
            </Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── One row in the side list ────────────────────────────────────────────────

function DriverRow({ d, selected, onSelect, onOpen }) {
  return (
    <div
      onClick={() => onSelect(d)}
      className={`px-3 py-2.5 cursor-pointer transition border-l-2
        ${selected ? 'bg-brand-100 border-brand-600' : 'border-transparent hover:bg-surface-alt'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink truncate">{d.name || `Driver #${d.driverId}`}</p>
          <p className="text-[11px] text-ink-muted truncate">{d.phone} · {d.city?.name || '—'}</p>
        </div>
        <StatusPill status={d.status} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <VehicleTypes types={d.vehicle?.types || []} number={d.vehicle?.number} />
        <ConnectionTag connection={d.connection} />
        <DutyBadge seconds={d.duty?.continuousSeconds} label={d.duty?.continuousLabel} />
        <PendingOfflineBadge show={d.duty?.pendingForceOffline} />
        <TestTag show={d.isTestUser} />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] text-ink-faint">
          {/* A driver can be online without a session row (data drift) — say so
              with a dash rather than inventing a start time. */}
          {d.session
            ? `Online ${fmtDur(d.session.durationLabel, d.session.durationSeconds)} · ${d.session.ridesCompleted ?? 0} rides`
            : 'Online since —'}
          {d.activeRide?.rideNumber ? ` · ${d.activeRide.rideNumber}` : ''}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(d); }}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-accent-navy hover:underline shrink-0"
        >
          Detail <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LiveMapPage() {
  const navigate = useNavigate();
  const [f, setFilter] = useUrlFilters(DEFAULT_FILTERS);
  const includeTest = f.test === '1';

  const [data, setData]       = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [live, setLive]       = useState(true);
  const [query, setQuery]     = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [fitKey, setFitKey]   = useState(null);
  const [offlineFor, setOfflineFor] = useState(null);
  const [toast, setToast]     = useState(null);

  // Deliberately no bounding box: the endpoint supports one, but ops want the
  // whole fleet in the side list in a single shot. Panning or zooming the map
  // must never silently drop drivers out of the list.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBusy(true);
    try {
      const [mapRes, sumRes] = await Promise.all([
        getLiveMap({
          cityId: f.cityId || undefined,
          vehicleType: f.vehicleType || undefined,
          status: f.status || undefined,
          includeTest,
          limit: MAP_LIMIT,
        }),
        getLiveMapSummary({ includeTest }),
      ]);
      setData(mapRes.data?.data || null);
      setSummary(sumRes.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load the live map'));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [f.cityId, f.vehicleType, f.status, includeTest]);

  // Filters changed → refetch immediately. Map movement does not refetch.
  useEffect(() => { load(); }, [load]);

  // Poll. A hidden tab burns quota for pins nobody is looking at, so skip those ticks.
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { if (!document.hidden) load({ silent: true }); }, POLL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const drivers = data?.drivers || [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.phone || '').includes(q) ||
      (d.vehicle?.number || '').toLowerCase().includes(q) ||
      String(d.driverId) === q
    );
  }, [drivers, query]);

  // Each icon pin is a DOM node. Past this many they stop being readable anyway
  // (they just overlap), so fall back to plain dots and say so in the legend.
  const dotsOnly = visible.length > ICON_PIN_LIMIT;

  const markers = useMemo(() => visible.map(d => {
    const m = statusMeta(d.status);
    // Toggle ON but app silent → grey and faded. The pin still exists (the
    // driver is still dispatchable) but its position can't be trusted.
    const offline = isDisconnected(d.connection);
    const colour = offline ? DISCONNECTED_COLOUR : m.colour;
    const selected = d.driverId === selectedId;

    const base = {
      id: d.driverId,
      lat: d.location?.latitude,
      lng: d.location?.longitude,
      colour,
      faded: offline,
      selected,
      tooltip:
        `<b>${d.name || 'Driver'}</b><br/>${m.label}` +
        `${d.vehicle?.types?.length ? ` · ${d.vehicle.types.join(', ')}` : ''}` +
        `${d.vehicle?.number ? `<br/>${d.vehicle.number}` : ''}` +
        `${d.activeRide?.rideNumber ? `<br/>On ${d.activeRide.rideNumber}` : ''}` +
        // Backend-authored sentence, verbatim — it encodes server config we
        // must not restate (see §0.2 of the API guide).
        (offline
          ? `<br/><span style="color:#b45309">${connectionMessage(d.connection)}</span>`
          : ''),
    };

    if (dotsOnly) return base;

    return {
      ...base,
      ...pinIcon({
        glyph: glyphForTypes(d.vehicle?.types || []),
        colour,
        faded: offline,
        selected,
        badge: d.activeRide?.rideNumber || null,
        size: selected ? 40 : 32,
      }),
    };
  }), [visible, selectedId, dotsOnly]);

  const cityOpts = useMemo(() => ([
    { value: '', label: 'All cities' },
    ...(summary?.byCity || []).map(c => ({
      value: String(c.cityId),
      label: c.cityName,
      count: (c.available || 0) + (c.onRide || 0),
    })),
  ]), [summary]);

  const vehicleOpts = useMemo(() => {
    const counts = Object.fromEntries((summary?.byCategory || [])
      .map(c => [c.vehicleType, (c.available || 0) + (c.onRide || 0)]));
    return VEHICLE_OPTS.map(o => (o.value ? { ...o, count: counts[o.value] ?? 0 } : o));
  }, [summary]);

  const selected = drivers.find(d => d.driverId === selectedId) || null;
  const openDetail = (d) => navigate(`/driver-metrics/drivers/${d.driverId}`);

  // Reaching the cap means pins are missing — never let that read as "that's all".
  const capped = data?.count >= MAP_LIMIT;
  const noLocation = summary?.totals?.withoutLocation || 0;

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <MapPin size={18} className="text-brand-700" /> Live Map
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Online drivers only — for offline drivers use All drivers.{' '}
            {data?.generatedAt ? `Updated ${fmtTime(data.generatedAt)}` : ''}
            {busy && <span className="ml-2 inline-flex items-center gap-1"><Spinner size={10} /> refreshing</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={live ? 'secondary' : 'outline'}
            size="sm"
            icon={live ? Radio : Pause}
            onClick={() => setLive(v => !v)}
            title={live ? `Auto-refresh every ${POLL_MS / 1000}s` : 'Auto-refresh is paused'}
          >
            {live ? 'Live' : 'Paused'}
          </Button>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load()} loading={busy}>
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" icon={Users} onClick={() => navigate('/driver-metrics')}>
            <span className="hidden sm:inline">All drivers</span>
          </Button>
          <Button variant="outline" size="sm" icon={BarChart3} onClick={() => navigate('/driver-metrics/fleet')}>
            <span className="hidden sm:inline">Fleet analytics</span>
          </Button>
        </div>
      </div>

      <SummaryChips summary={summary} />

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
              Filter loaded pins
            </label>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Name, phone, vehicle number…"
            />
          </div>
          <Select label="City"    value={f.cityId}      onChange={(v) => setFilter({ cityId: v })}      options={cityOpts}    className="min-w-[170px]" />
          <Select label="Vehicle" value={f.vehicleType} onChange={(v) => setFilter({ vehicleType: v })} options={vehicleOpts} className="min-w-[160px]" />
          <Select label="Status"  value={f.status}      onChange={(v) => setFilter({ status: v })}      options={STATUS_OPTS}  className="min-w-[180px]" />
          <label className="flex items-center gap-2 text-xs text-ink-muted pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setFilter({ test: e.target.checked ? '1' : '' })}
              className="accent-accent-navy"
            />
            Include test users
          </label>
          <Button variant="ghost" size="sm" icon={Crosshair} onClick={() => setFitKey(Date.now())} className="pb-2">
            Fit to pins
          </Button>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {capped && (
        <Alert tone="warning" title="Only the first 2000 pins are shown">
          Apply a city or vehicle filter — some drivers are being left out of this list right now.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <MapView
            markers={markers}
            onMarkerClick={(m) => setSelectedId(m.id)}
            fitKey={fitKey}
            className="w-full"
            style={{ height: 560 }}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[10px] text-ink-muted">
            <span className="font-semibold uppercase tracking-wider text-ink-faint">Pin colour</span>
            <LegendPin colour="#138808" label="Available" dot={dotsOnly} />
            <LegendPin colour="#1e3a8a" label="On ride" dot={dotsOnly} />
            <LegendPin colour={DISCONNECTED_COLOUR} label="Online but app not responding" faded dot={dotsOnly} />

            {!dotsOnly && (
              <>
                <span className="font-semibold uppercase tracking-wider text-ink-faint">Icon</span>
                <LegendGlyph types={['bike']}  label="Bike" />
                <LegendGlyph types={['auto']}  label="Auto" />
                <LegendGlyph types={['car']}   label="Car / premium / luxury" />
                <LegendGlyph types={['xl']}    label="XL" />
              </>
            )}

            {dotsOnly && (
              <span className="text-ink-faint">
                Too many drivers to draw vehicle icons — showing plain dots. Filter to see the icons.
              </span>
            )}

            {noLocation > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle size={11} /> {noLocation} online drivers have no location — they are not on the map
              </span>
            )}
          </div>
        </div>

        <Card padding="none" className="overflow-hidden flex flex-col" style={{ maxHeight: 620 }}>
          <div className="px-3 py-2.5 border-b border-line bg-surface-alt flex items-center justify-between">
            <p className="text-xs font-semibold text-ink">
              Online now · {visible.length}
              {query && drivers.length !== visible.length && (
                <span className="text-ink-faint font-normal"> of {drivers.length}</span>
              )}
            </p>
            {data?.staleAfterSeconds && (
              <span className="text-[10px] text-ink-faint" title="A pin is treated as stale after this long without a ping">
                stale after {Math.round(data.staleAfterSeconds / 60)}m
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {loading ? (
              <div className="py-16 flex justify-center"><Spinner size={20} /></div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No drivers online in this filter"
                description="Clear the filters to see everyone who is online."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setQuery(''); setFilter({ cityId: '', vehicleType: '', status: '' }); }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              visible.map(d => (
                <DriverRow
                  key={d.driverId}
                  d={d}
                  selected={d.driverId === selectedId}
                  onSelect={(x) => setSelectedId(x.driverId)}
                  onOpen={openDetail}
                />
              ))
            )}
          </div>

          {selected && (
            <div className="border-t border-line p-3 bg-surface-soft space-y-2">
              <p className="text-xs font-semibold text-ink truncate">{selected.name || `Driver #${selected.driverId}`}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openDetail(selected)}>
                  Open detail
                </Button>
                <Button size="sm" variant="danger" icon={PowerOff} onClick={() => setOfflineFor(selected)}>
                  Force offline
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Alert tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Alert>
        </div>
      )}

      {offlineFor && (
        <ForceOfflineModal
          driver={offlineFor}
          onClose={() => setOfflineFor(null)}
          onDone={(r) => { setToast(forceOfflineToast(r)); load(); }}
        />
      )}
    </div>
  );
}

/** Same teardrop the map draws, shrunk — or a dot when the map fell back to dots. */
function LegendPin({ colour, label, faded, dot }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot ? (
        <span
          className="w-2.5 h-2.5 rounded-full ring-2 ring-white"
          style={{ background: colour, opacity: faded ? 0.5 : 1 }}
        />
      ) : (
        <svg width="13" height="17" viewBox="0 0 34 44" style={{ opacity: faded ? 0.75 : 1 }}>
          <path d={PIN_PATH} fill="#ffffff" stroke={colour} strokeWidth="3" />
        </svg>
      )}
      {label}
    </span>
  );
}

/** Grey pin showing which glyph a vehicle category gets. */
function LegendGlyph({ types, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="#062154" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: glyphForTypes(types) }}
      />
      {label}
    </span>
  );
}
