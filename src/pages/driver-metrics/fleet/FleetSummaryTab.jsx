import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Clock, TrendingUp, Activity, AlertTriangle, ListChecks } from 'lucide-react';
import { getFleetSummary } from '../../../api/opsApi.js';
import {
  Card, CardHeader, Alert, Spinner, EmptyState, StatTile, Badge, LineChart,
  DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import { Field } from '../DriverBits.jsx';
import {
  defaultRange, MAX_RANGE_DAYS, fmtDur, fmtNum, fmtDec, fmtDateTime, fmtTime,
  fmtYmd, secToLabel, apiError, IST,
} from '../metricsMeta.js';

// Beyond this many hourly points the line turns to mush — roll up to daily peaks.
const DOWNSAMPLE_ABOVE = 240;

const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' });

export default function FleetSummaryTab({ includeTest }) {
  const [range, setRange] = useState(() => defaultRange(7));
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFleetSummary({ ...range, includeTest });
      setD(res.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load fleet summary'));
    } finally {
      setLoading(false);
    }
  }, [range, includeTest]);

  useEffect(() => { load(); }, [load]);

  const hourly = d?.hourlyConcurrency || [];

  const { series, rolledUp } = useMemo(() => {
    if (!hourly.length) return { series: [], rolledUp: false };

    if (hourly.length <= DOWNSAMPLE_ABOVE) {
      return {
        rolledUp: false,
        series: hourly.map(h => ({
          label: fmtDateTime(h.hourStart),
          value: h.driversOnline || 0,
          tooltip: <><b>{fmtDateTime(h.hourStart)}</b> · {h.driversOnline || 0} drivers online</>,
        })),
      };
    }

    // Daily peak — the staffing question is "how many at the busiest moment",
    // so max is the honest roll-up here, not mean.
    const byDay = new Map();
    for (const h of hourly) {
      const key = istDate.format(new Date(h.hourStart));
      const cur = byDay.get(key);
      if (!cur || (h.driversOnline || 0) > cur.value) {
        byDay.set(key, { value: h.driversOnline || 0, at: h.hourStart });
      }
    }
    return {
      rolledUp: true,
      series: [...byDay.entries()].map(([day, v]) => ({
        label: fmtYmd(day),
        value: v.value,
        tooltip: <><b>{fmtYmd(day)}</b> · peak {v.value} drivers<br />{fmtTime(v.at)} baje</>,
      })),
    };
  }, [hourly]);

  const peakIndex = useMemo(() => {
    if (!series.length) return null;
    let best = 0;
    series.forEach((p, i) => { if (p.value > series[best].value) best = i; });
    return best;
  }, [series]);

  const breakdown = d?.sessionEndBreakdown || {};
  const involuntaryShare = d?.totalSessions
    ? (breakdown.involuntary || 0) / d.totalSessions * 100
    : null;
  const unhealthy = involuntaryShare != null && involuntaryShare > 20;

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
      ) : !d ? (
        <EmptyState icon={Activity} title="No fleet data" description="Nothing was recorded in this range." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <StatTile label="Active drivers" value={fmtNum(d.activeDrivers, '0')} icon={Users} tone="navy" />
            <StatTile label="Total online" value={fmtDur(null, d.totalOnlineSeconds)} sub={`${fmtDec(d.totalOnlineHours, 0)} hours`} icon={Clock} />
            <StatTile label="Sessions" value={fmtNum(d.totalSessions, '0')} sub={`avg ${fmtDur(d.avgSessionLabel, d.avgSessionSeconds)}`} icon={ListChecks} />
            <StatTile label="Avg / driver" value={d.avgHoursPerDriver != null ? secToLabel(d.avgHoursPerDriver * 3600) : '—'} icon={TrendingUp} />
            <StatTile
              label="Peak concurrency"
              value={fmtNum(d.peakHour?.driversOnline, '—')}
              sub={d.peakHour?.hourStart ? fmtDateTime(d.peakHour.hourStart) : undefined}
              icon={Activity}
              tone="brand"
              hint="The main input for staffing decisions"
            />
          </div>

          {unhealthy && (
            <Alert tone="warning" title="Check app stability">
              {fmtNum(breakdown.involuntary)} sessions ({fmtDec(involuntaryShare, 1)}%) ended on their own —
              the drivers did not go offline themselves. A ratio this high points at app or network trouble.
            </Alert>
          )}

          <Card className="space-y-3">
            <CardHeader
              title="Drivers online over time"
              subtitle={rolledUp
                ? 'Daily peak — the range is long, so each day shows its highest point'
                : 'Hourly'}
              right={
                <span title="Online at any point during that hour — not exact instantaneous concurrency">
                  <Badge tone="neutral">“online at any point that hour”</Badge>
                </span>
              }
            />
            <LineChart data={series} peakIndex={peakIndex} height={220} format={(v) => String(Math.round(v))} />
            <p className="text-[10px] text-ink-faint">
              Gold dashed line marks the peak. This counts drivers online at any point during the hour —
              not how many were online at the same instant.
            </p>
          </Card>

          <Card className="space-y-3">
            <CardHeader
              title="How sessions ended"
              subtitle="Involuntary ends are a fleet-health signal"
              right={unhealthy ? <Badge tone="warning" icon={AlertTriangle}>Health warning</Badge> : null}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field
                label="Involuntary"
                value={fmtNum(breakdown.involuntary, '0')}
                tone={unhealthy ? 'danger' : undefined}
                hint="Ended by an app crash, network drop, or system rule"
              />
              <Field label="Break forced" value={fmtNum(breakdown.breakForced, '0')} />
              <Field label="City drift" value={fmtNum(breakdown.cityDrift, '0')} hint="Driver left the service area" />
              <Field
                label="Involuntary share"
                value={involuntaryShare == null ? '—' : `${fmtDec(involuntaryShare, 1)}%`}
                tone={unhealthy ? 'danger' : undefined}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
