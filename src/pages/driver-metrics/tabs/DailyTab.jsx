import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Car, Wallet, TrendingUp } from 'lucide-react';
import { getDriverDaily } from '../../../api/opsApi.js';
import {
  Card, CardHeader, Alert, Spinner, EmptyState, StatTile, BarChart,
  DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import {
  defaultRange, MAX_RANGE_DAYS, fmtDur, fmtMoney, fmtNum, fmtDec, fmtYmd,
  fmtTime, apiError, secToLabel,
} from '../metricsMeta.js';

/**
 * Hours-per-day and rides-per-day, as two stacked single-series charts sharing
 * an x-axis. Overlaying rides on the hours chart would need a second y-scale,
 * which makes the crossings look meaningful when they aren't.
 */
export default function DailyTab({ driverId }) {
  const [range, setRange] = useState(() => defaultRange(30));
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDriverDaily(driverId, range);
      setData(res.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load daily data'));
    } finally {
      setLoading(false);
    }
  }, [driverId, range]);

  useEffect(() => { load(); }, [load]);

  const days = data?.days || [];

  // Empty days are part of the payload on purpose — keeping them keeps the
  // x-axis honest about gaps instead of squeezing a holiday out of the chart.
  const hoursSeries = useMemo(() => days.map(d => ({
    label: fmtYmd(d.date),
    value: d.onlineHours || 0,
    tooltip: (
      <>
        <b>{fmtYmd(d.date)}</b> · {fmtDur(d.onlineLabel, d.onlineSeconds)}<br />
        {d.sessionsCount || 0} sessions
        {d.firstOnlineAt ? ` · ${fmtTime(d.firstOnlineAt)}→${d.lastOfflineAt ? fmtTime(d.lastOfflineAt) : 'open'}` : ''}
        {d.hasOpenSession ? <><br />Session still open</> : null}
      </>
    ),
  })), [days]);

  const ridesSeries = useMemo(() => days.map(d => ({
    label: fmtYmd(d.date),
    value: d.ridesCompleted || 0,
    tooltip: (
      <>
        <b>{fmtYmd(d.date)}</b> · {d.ridesCompleted || 0} completed<br />
        {d.ridesRejected || 0} rejected (incl. {d.ridesAutoRejected || 0} auto-rejected)<br />
        {d.ridesCancelledByDriver || 0} cancelled by driver · {d.ridesCancelledByOther || 0} by others<br />
        {fmtMoney(d.grossFare)} · {fmtDec(d.distanceKm, 1)} km
      </>
    ),
  })), [days]);

  const t = data?.totals || {};
  const neverOnline = days.length > 0 && days.every(d => !d.onlineSeconds);

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
      ) : !days.length ? (
        <EmptyState icon={CalendarDays} title="No data" description="Nothing was recorded in this range." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <StatTile label="Total online" value={fmtDur(t.onlineLabel, t.onlineSeconds)} icon={Clock} tone="navy" />
            <StatTile
              label="Active days"
              value={fmtNum(t.activeDays, '0')}
              sub={`out of ${days.length} in range`}
              icon={CalendarDays}
              hint="Days the driver was actually online"
            />
            <StatTile
              label="Avg / active day"
              value={t.avgHoursPerActiveDay != null ? secToLabel(t.avgHoursPerActiveDay * 3600) : '—'}
              icon={TrendingUp}
              hint="Averaged over active days only — days off do not drag it down"
            />
            <StatTile label="Rides completed" value={fmtNum(t.ridesCompleted, '0')} icon={Car} />
            <StatTile label="Gross fare" value={fmtMoney(t.grossFare)} icon={Wallet} />
          </div>

          {neverOnline && (
            <Alert tone="info">The driver was never online in this range.</Alert>
          )}

          <Card className="space-y-3">
            <CardHeader title="Online hours per day" subtitle="Empty days are drawn as zero-height bars, not skipped" />
            <BarChart data={hoursSeries} color="#062154" format={(v) => `${v % 1 === 0 ? v : v.toFixed(1)}h`} height={180} />
          </Card>

          <Card className="space-y-3">
            <CardHeader
              title="Rides completed per day"
              subtitle="Hover for the rejected / cancelled breakdown"
            />
            <BarChart data={ridesSeries} color="#a97c2f" format={(v) => String(Math.round(v))} height={150} />
          </Card>
        </>
      )}
    </div>
  );
}
