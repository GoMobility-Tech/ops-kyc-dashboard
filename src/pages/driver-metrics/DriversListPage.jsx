import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, RefreshCw, MapPin, BarChart3, ChevronDown, ChevronRight,
  UserX, ShieldAlert, CircleSlash, Radio, Car, PowerOff, User,
} from 'lucide-react';
import { getDriversList, getDriversSummary, getLiveMapSummary } from '../../api/opsApi.js';
import useUrlFilters from '../../utils/useUrlFilters.js';
import {
  Button, Card, Badge, Select, SearchBar, Alert, Spinner, EmptyState, StatTile,
  Table, THead, TBody, TH, TR, TD, DateRangeFilter, ROLLING_PRESETS,
} from '../../components/ui';
import {
  defaultRange, MAX_RANGE_DAYS, ROSTER_STATUS_OPTS, ROSTER_SORT_OPTS,
  VERIFIED_OPTS, VEHICLE_OPTS, fmtDur, fmtMoney, fmtNum, fmtRate, fmtRelative,
  fmtFull, apiError,
} from './metricsMeta.js';
import {
  StatusPill, ConnectionTag, NeverOnlineBadge, PendingOfflineBadge, TestTag, VehicleTypes,
} from './DriverBits.jsx';

const PAGE = 50;

// Filters live in the URL so a filtered roster survives refresh and back-nav
// from a driver's detail page.
const DEFAULT_FILTERS = {
  q: '', status: '', cityId: '', vehicleType: '', verified: '',
  sort: 'last_seen', test: '',
};

function Avatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="w-8 h-8 rounded-lg bg-brand-200 text-brand-800 flex items-center justify-center shrink-0">
        <User size={14} />
      </span>
    );
  }
  return (
    <img
      src={src} alt={name || 'Driver'} onError={() => setFailed(true)}
      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-line"
    />
  );
}

export default function DriversListPage() {
  const navigate = useNavigate();
  const [f, setFilter, resetFilters, isFiltered] = useUrlFilters(DEFAULT_FILTERS);
  const includeTest = f.test === '1';

  // The metrics window only scopes the `range` block — a driver with no activity
  // still shows up, with zeroes. That is the whole point of this screen.
  const [range, setRange] = useState(() => defaultRange(7));

  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [summary, setSummary] = useState(null);
  const [cities, setCities]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore]       = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async ({ offset = 0, append = false, silent = false } = {}) => {
    if (append) setMore(true);
    else if (silent) setBusy(true);
    else setLoading(true);
    try {
      const res = await getDriversList({
        search: f.q || undefined,
        status: f.status || undefined,
        cityId: f.cityId || undefined,
        vehicleType: f.vehicleType || undefined,
        isVerified: f.verified || undefined,
        ...range,
        sort: f.sort,
        includeTest,
        limit: PAGE,
        offset,
      });
      const d = res.data?.data || {};
      setItems(prev => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
      setTotal(d.total || 0);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load drivers'));
    } finally {
      setLoading(false); setMore(false); setBusy(false);
    }
  }, [f.q, f.status, f.cityId, f.vehicleType, f.verified, f.sort, range, includeTest]);

  useEffect(() => { load(); }, [load]);

  const loadSummary = useCallback(() => {
    getDriversSummary({ includeTest })
      .then(res => setSummary(res.data?.data || null))
      .catch(() => setSummary(null));
  }, [includeTest]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // No city master endpoint exists in this module. live-map/summary's byCity is
  // the only source, so the dropdown only lists cities that have someone online.
  useEffect(() => {
    let cancelled = false;
    getLiveMapSummary({ includeTest: true })
      .then(res => { if (!cancelled) setCities(res.data?.data?.byCity || []); })
      .catch(() => { /* filter degrades to "All cities" */ });
    return () => { cancelled = true; };
  }, []);

  const cityOpts = useMemo(() => ([
    { value: '', label: 'All cities' },
    ...cities.map(c => ({ value: String(c.cityId), label: c.cityName })),
  ]), [cities]);

  const s = summary || {};
  // `neverOnline` is not a server-side filter — flag it client-side on what loaded.
  const [neverOnlineOnly, setNeverOnlineOnly] = useState(false);
  const visible = neverOnlineOnly ? items.filter(d => d.neverOnline) : items;

  const chip = (label, value, tone, icon, onClick, hint) => (
    <StatTile label={label} value={fmtNum(value, '—')} tone={tone} icon={icon} onClick={onClick} hint={hint} />
  );

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <Users size={18} className="text-brand-700" /> Drivers
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Every driver — online, offline and never-online
            {busy && <span className="ml-2 inline-flex items-center gap-1"><Spinner size={10} /> refreshing</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => { load({ silent: true }); loadSummary(); }} loading={busy}>
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" icon={MapPin} onClick={() => navigate('/driver-metrics/map')}>
            <span className="hidden sm:inline">Live map</span>
          </Button>
          <Button variant="outline" size="sm" icon={BarChart3} onClick={() => navigate('/driver-metrics/fleet')}>
            <span className="hidden sm:inline">Fleet analytics</span>
          </Button>
        </div>
      </div>

      {/* Roster chips — fleet-wide, unaffected by the filters below. Clicking one
          applies the matching filter, so a count is also a way in. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {chip('Total', s.totalDrivers, 'navy', Users, () => { setNeverOnlineOnly(false); resetFilters(); })}
        {chip('Online', s.online, 'success', Radio, () => { setNeverOnlineOnly(false); setFilter({ status: 'online' }); })}
        {chip('On ride', s.onRide, 'info', Car, () => { setNeverOnlineOnly(false); setFilter({ status: 'on_ride' }); })}
        {chip('Offline', s.offline, 'neutral', PowerOff, () => { setNeverOnlineOnly(false); setFilter({ status: 'offline' }); })}
        {chip('Unverified', s.unverified, s.unverified > 0 ? 'warning' : 'neutral', ShieldAlert,
          () => { setNeverOnlineOnly(false); setFilter({ verified: 'false' }); }, 'Action item — KYC still pending')}
        {chip('Never online', s.neverOnline, s.neverOnline > 0 ? 'warning' : 'neutral', CircleSlash,
          () => { setFilter({ status: '', sort: 'newest' }); setNeverOnlineOnly(true); },
          'Signed up but never went on duty — onboarding drop-off, not churn')}
        {chip('Deactivated', s.deactivated, 'neutral', UserX, null)}
      </div>

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Search</label>
            <SearchBar
              value={f.q}
              onSubmit={(v) => (v === f.q ? load() : setFilter({ q: v }))}
              placeholder="Name or phone…"
            />
          </div>
          <Select label="Status"   value={f.status}      onChange={(v) => { setNeverOnlineOnly(false); setFilter({ status: v }); }} options={ROSTER_STATUS_OPTS} className="min-w-[150px]" />
          <Select label="City"     value={f.cityId}      onChange={(v) => setFilter({ cityId: v })}      options={cityOpts}    className="min-w-[150px]" />
          <Select label="Vehicle"  value={f.vehicleType} onChange={(v) => setFilter({ vehicleType: v })} options={VEHICLE_OPTS} className="min-w-[140px]" />
          <Select label="KYC"      value={f.verified}    onChange={(v) => setFilter({ verified: v })}    options={VERIFIED_OPTS} className="min-w-[150px]" />
          <Select label="Sort by"  value={f.sort}        onChange={(v) => setFilter({ sort: v })}        options={ROSTER_SORT_OPTS} className="min-w-[150px]" />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <DateRangeFilter
            from={range.from}
            to={range.to}
            fieldOptions={[]}
            presets={ROLLING_PRESETS}
            maxDays={MAX_RANGE_DAYS}
            allowAll={false}
            label="Metrics window"
            onChange={({ from, to }) => from && setRange({ from, to: to || from })}
          />
          <div className="flex items-center gap-3 pb-1">
            <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(e) => setFilter({ test: e.target.checked ? '1' : '' })}
                className="accent-accent-navy"
              />
              Include test users
            </label>
            {(isFiltered || neverOnlineOnly) && (
              <Button variant="ghost" size="sm" onClick={() => { setNeverOnlineOnly(false); resetFilters(); }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <p className="text-[10px] text-ink-faint">
          The metrics window only scopes the hours / rides / earnings columns — drivers with no
          activity in it still appear, with zeroes.
        </p>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {neverOnlineOnly && (
        <Alert tone="info" title="Showing drivers who have never gone on duty">
          Filtered from the {items.length} loaded rows — load more to widen the search.
          This is an onboarding drop-off list, not a churn list.
        </Alert>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No drivers match these filters"
          description="Clear the filters or widen the metrics window."
          action={<Button variant="outline" size="sm" onClick={() => { setNeverOnlineOnly(false); resetFilters(); }}>Clear filters</Button>}
        />
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">
            Showing {visible.length}{neverOnlineOnly ? ` of ${items.length} loaded` : ` of ${total}`}
            <span className="text-ink-faint"> · metrics for {range.from} → {range.to}</span>
          </p>

          <Table>
            <THead>
              <tr>
                <TH>Driver</TH>
                <TH>Status</TH>
                <TH>Last seen</TH>
                <TH align="right">Online</TH>
                <TH align="right">Rides</TH>
                <TH align="right">Acceptance</TH>
                <TH align="right">Earnings</TH>
                <TH>City / Vehicle</TH>
                <TH align="right"></TH>
              </tr>
            </THead>
            <TBody>
              {visible.map(d => {
                const r = d.range || {};
                return (
                  <TR key={d.driverId} onClick={() => navigate(`/driver-metrics/drivers/${d.driverId}`)}>
                    <TD className="max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <Avatar src={d.photo} name={d.name} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{d.name || `Driver #${d.driverId}`}</p>
                          <p className="text-[11px] text-ink-muted truncate">{d.phone}</p>
                        </div>
                      </div>
                    </TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusPill status={d.status} />
                        <ConnectionTag connection={d.connection} />
                        <NeverOnlineBadge show={d.neverOnline} />
                        <PendingOfflineBadge show={d.pendingForceOffline} />
                        {d.isVerified === false && <Badge tone="warning">Unverified</Badge>}
                        {d.isActive === false && <Badge tone="danger">Inactive</Badge>}
                        <TestTag show={d.isTestUser} />
                      </div>
                    </TD>

                    <TD>
                      <p className="text-xs text-ink" title={d.lastSeenAt ? fmtFull(d.lastSeenAt) : undefined}>
                        {d.neverOnline ? '—' : fmtRelative(d.lastSeenAt)}
                      </p>
                    </TD>

                    <TD align="right">
                      <span className="text-xs font-semibold text-ink tabular-nums">
                        {r.onlineSeconds ? fmtDur(r.onlineLabel, r.onlineSeconds) : '0h 0m'}
                      </span>
                      {r.sessionsCount > 0 && (
                        <p className="text-[10px] text-ink-faint">{r.sessionsCount} sessions</p>
                      )}
                    </TD>

                    <TD align="right">
                      <span className="text-xs text-ink tabular-nums">{fmtNum(r.ridesCompleted, '0')}</span>
                      {r.ridesCancelled > 0 && (
                        <span className="text-[10px] text-red-600 ml-1">/ {r.ridesCancelled}</span>
                      )}
                    </TD>

                    <TD align="right">
                      {/* null = no offers at all in this window, which is not 0% */}
                      <span className={`text-xs tabular-nums ${r.acceptanceRate == null ? 'text-ink-faint' : 'text-ink'}`}>
                        {fmtRate(r.acceptanceRate)}
                      </span>
                    </TD>

                    <TD align="right">
                      <span className="text-xs font-semibold text-ink tabular-nums">{fmtMoney(r.grossFare)}</span>
                    </TD>

                    <TD className="max-w-[180px]">
                      <p className="text-[11px] text-ink-muted truncate">{d.city?.name || '—'}</p>
                      <VehicleTypes types={d.vehicle?.types || []} number={d.vehicle?.number} />
                    </TD>

                    <TD align="right">
                      <ChevronRight size={14} className="text-ink-faint inline" />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          {items.length < total && (
            <Button
              variant="outline"
              className="w-full"
              icon={ChevronDown}
              loading={more}
              onClick={() => load({ offset: items.length, append: true })}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
