import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, Car, Percent, Wallet, Star, TrendingUp, AlertTriangle, BarChart3,
} from 'lucide-react';
import { getDriverStats } from '../../../api/opsApi.js';
import {
  Card, CardHeader, Alert, Spinner, EmptyState, StatTile, Badge, Heatstrip,
  DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import { Field } from '../DriverBits.jsx';
import {
  defaultRange, MAX_RANGE_DAYS, fmtDur, fmtMoney, fmtNum, fmtDec, fmtRate,
  fmtKm, fmtFull, hourLabel, DOW_NAMES, DOW_SHORT, secToLabel, apiError,
} from '../metricsMeta.js';

// > 20% of sessions ending on their own is a broken-phone signal, not a lazy driver.
const INVOLUNTARY_RED_FLAG = 20;

export default function StatsTab({ driverId }) {
  const [range, setRange] = useState(() => defaultRange(30));
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDriverStats(driverId, range);
      setS(res.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load stats'));
    } finally {
      setLoading(false);
    }
  }, [driverId, range]);

  useEffect(() => { load(); }, [load]);

  const hourSeries = useMemo(() => {
    const h = s?.patterns?.hourHistogram || {};
    return Array.from({ length: 24 }, (_, i) => ({
      label: i % 3 === 0 ? String(i) : '',
      value: h[String(i)] || 0,
      tooltip: <><b>{hourLabel(i)}</b> · {h[String(i)] || 0} rides</>,
    }));
  }, [s]);

  const dowSeries = useMemo(() => {
    const d = s?.patterns?.dowHistogram || {};
    // Postgres DOW: index 0 is Sunday.
    return DOW_SHORT.map((label, i) => ({
      label,
      value: d[String(i)] || 0,
      tooltip: <><b>{DOW_NAMES[i]}</b> · {d[String(i)] || 0} rides</>,
    }));
  }, [s]);

  const online = s?.online || {};
  const rel    = s?.reliability || {};
  const rides  = s?.rides || {};
  const rates  = s?.rates || {};
  const pat    = s?.patterns || {};
  const flagged = rel.involuntaryRate != null && rel.involuntaryRate > INVOLUNTARY_RED_FLAG;

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          fieldOptions={[]}
          presets={ROLLING_PRESETS}
          maxDays={MAX_RANGE_DAYS}
          allowAll={false}
          onChange={({ from, to }) => from && setRange({ from, to: to || from })}
        />
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : !s ? (
        <EmptyState icon={BarChart3} title="No stats" description="No data available for this range." />
      ) : (
        <>
          {/* rates.* can be null — fmtRate renders "—" rather than a fake 0%. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatTile label="Total online" value={fmtDur(online.totalLabel, online.totalSeconds)} icon={Clock} tone="navy" />
            <StatTile label="Rides completed" value={fmtNum(rides.completed, '0')} icon={Car} />
            <StatTile
              label="Acceptance rate"
              value={fmtRate(rates.acceptanceRate)}
              icon={Percent}
              hint="null means no offers at all — not 0%"
            />
            <StatTile label="Earnings / hour" value={rates.earningsPerOnlineHour == null ? '—' : fmtMoney(rates.earningsPerOnlineHour)} icon={Wallet} />
          </div>

          {flagged && (
            <Alert tone="danger" title={`${fmtRate(rel.involuntaryRate)} of sessions ended on their own`}>
              These sessions ended from an app crash or network drop — the driver did not go offline
              themselves. Worth checking their phone or app.
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Online ─────────────────────────────────────────────────── */}
            <Card className="space-y-3">
              <CardHeader title="Online behaviour" subtitle={`${s.from} → ${s.to}`} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Sessions" value={fmtNum(online.sessionsCount, '0')} />
                <Field label="Active days" value={fmtNum(online.activeDays, '0')} />
                <Field label="Avg / active day" value={online.avgHoursPerActiveDay != null ? secToLabel(online.avgHoursPerActiveDay * 3600) : '—'} />
                <Field label="Avg session" value={secToLabel(online.avgSessionSeconds)} />
                <Field label="Longest session" value={fmtDur(online.longestSessionLabel, online.longestSessionSeconds)} />
                <Field label="Open sessions" value={fmtNum(online.openSessions, '0')} />
                <Field label="First session" value={fmtFull(online.firstSessionAt)} />
                <Field label="Last activity" value={fmtFull(online.lastActivityAt)} />
              </div>
            </Card>

            {/* ── Reliability ────────────────────────────────────────────── */}
            <Card className="space-y-3">
              <CardHeader
                title="Reliability"
                subtitle="Sessions that ended from an app crash or network drop"
                right={flagged ? <Badge tone="danger" icon={AlertTriangle}>Red flag</Badge> : null}
              />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Involuntary ends" value={fmtNum(rel.involuntaryEnds, '0')} tone={flagged ? 'danger' : undefined} />
                <Field label="Break-forced ends" value={fmtNum(rel.breakForcedEnds, '0')} />
                <Field
                  label="Involuntary rate"
                  value={fmtRate(rel.involuntaryRate)}
                  tone={flagged ? 'danger' : undefined}
                  hint="Share of sessions the driver did not end themselves"
                />
              </div>

              <div className="pt-2 border-t border-line grid grid-cols-3 gap-3">
                <Field label="Rating" value={s.rating?.average != null ? fmtDec(s.rating.average, 2) : '—'} />
                <Field label="Rating count" value={fmtNum(s.rating?.count, '0')} />
                <Field label="Rides / online hour" value={fmtRate(rates.ridesPerOnlineHour, '')} />
              </div>
            </Card>
          </div>

          {/* ── Ride funnel ──────────────────────────────────────────────── */}
          <Card className="space-y-3">
            <CardHeader title="Ride funnel" subtitle="Offer se completion tak" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <Field
                label="Offered (approx)"
                value={rides.offeredApprox == null ? '—' : `~${fmtNum(rides.offeredApprox)}`}
                hint="Approximate — there is no offers table; derived from accepted + rejections"
              />
              <Field label="Accepted" value={fmtNum(rides.accepted, '0')} />
              <Field
                label="Rejected"
                value={fmtNum(rides.rejected, '0')}
                hint={`Includes ${fmtNum(rides.autoRejected, '0')} auto-rejected on timeout`}
              />
              <Field label="Completed" value={fmtNum(rides.completed, '0')} tone="success" />
              <Field label="Cancelled by driver" value={fmtNum(rides.cancelledByDriver, '0')} />
              <Field label="Cancelled by others" value={fmtNum((rides.cancelledByPassenger || 0) + (rides.cancelledBySystem || 0), '0')} hint="Passenger + system" />
            </div>

            <div className="pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <Field label="Gross fare" value={fmtMoney(rides.grossFare)} />
              <Field label="Distance" value={fmtKm(rides.distanceKm)} />
              <Field label="Avg distance" value={fmtKm(rides.avgDistanceKm)} />
              <Field label="Avg ride time" value={rides.avgRideMinutes == null ? '—' : `${rides.avgRideMinutes} min`} />
              <Field label="Completion rate" value={fmtRate(rates.completionRate)} />
              <Field label="Driver cancel rate" value={fmtRate(rates.driverCancelRate)} />
            </div>
          </Card>

          {/* ── Patterns ─────────────────────────────────────────────────── */}
          <Card className="space-y-4">
            <CardHeader
              title="When this driver works"
              subtitle="Rides by hour of day and day of week"
              right={
                <div className="flex gap-1.5">
                  {pat.busiestHourOfDay != null && (
                    <Badge tone="brand" icon={TrendingUp}>Peak {hourLabel(pat.busiestHourOfDay)}</Badge>
                  )}
                  {pat.busiestDayOfWeek != null && (
                    <Badge tone="brand" icon={Star}>{DOW_NAMES[pat.busiestDayOfWeek] || '—'}</Badge>
                  )}
                </div>
              }
            />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">
                Hour of day · empty cell = never online in that hour
              </p>
              <Heatstrip data={hourSeries} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Day of week</p>
              <Heatstrip data={dowSeries} color="169, 124, 47" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
