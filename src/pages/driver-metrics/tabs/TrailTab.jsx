import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Crosshair, Gauge, Navigation } from 'lucide-react';
import { getDriverLocationHistory } from '../../../api/opsApi.js';
import MapView from '../../../components/map/MapView.jsx';
import {
  Card, Alert, Spinner, EmptyState, Badge, Button, StatTile,
  DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import { defaultRange, fmtDec, fmtFull, fmtNum, apiError } from '../metricsMeta.js';
import { pinIcon, GLYPH_START, GLYPH_END } from '../vehicleIcon.js';

const ON_DUTY_COLOUR = '#1e3a8a';
const IDLE_COLOUR    = '#8a8176';

// Trails are heavy — one day at a time by default, and never more than a week.
const TRAIL_PRESETS = ROLLING_PRESETS.filter(p => ['today', 'last_7'].includes(p.key));

/**
 * Splits the point stream into runs of the same duty state so the polyline can
 * be solid where the driver was on a ride and dashed where they were idling.
 */
function toSegments(points) {
  const out = [];
  let run = null;
  for (const p of points) {
    if (p.latitude == null || p.longitude == null) continue;
    const onDuty = Boolean(p.isOnDuty);
    if (!run || run.onDuty !== onDuty) {
      // Repeat the boundary point so consecutive runs visually connect.
      const seed = run?.points.length ? [run.points[run.points.length - 1]] : [];
      run = { onDuty, points: [...seed] };
      out.push(run);
    }
    run.points.push([p.latitude, p.longitude]);
  }
  return out
    .filter(r => r.points.length >= 2)
    .map(r => ({ points: r.points, colour: r.onDuty ? ON_DUTY_COLOUR : IDLE_COLOUR, dashed: !r.onDuty }));
}

export default function TrailTab({ driverId }) {
  const [range, setRange] = useState(() => defaultRange(1));
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fitKey, setFitKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDriverLocationHistory(driverId, { ...range, limit: 5000 });
      setData(res.data?.data || null);
      setError('');
      setFitKey(Date.now());
    } catch (e) {
      setError(apiError(e, 'Failed to load location trail'));
    } finally {
      setLoading(false);
    }
  }, [driverId, range]);

  useEffect(() => { load(); }, [load]);

  const points   = data?.points || [];
  const segments = useMemo(() => toSegments(points), [points]);

  const markers = useMemo(() => {
    if (points.length < 1) return [];
    const first = points[0];
    const last  = points[points.length - 1];
    const mk = (p, colour, label, glyph) => ({
      id: label,
      lat: p.latitude,
      lng: p.longitude,
      colour,
      tooltip: `<b>${label}</b><br/>${fmtFull(p.recordedAt)}`,
      ...pinIcon({ glyph, colour, size: 30 }),
    });
    return points.length === 1
      ? [mk(first, '#138808', 'Only point', GLYPH_START)]
      : [mk(first, '#138808', 'Start', GLYPH_START), mk(last, '#a97c2f', 'End', GLYPH_END)];
  }, [points]);

  const onDutyCount = points.filter(p => p.isOnDuty).length;
  const disabled    = data && data.breadcrumbsEnabled === false;

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <DateRangeFilter
            from={range.from}
            to={range.to}
            fieldOptions={[]}
            presets={TRAIL_PRESETS}
            maxDays={7}
            allowAll={false}
            label="Trail range"
            onChange={({ from, to }) => from && setRange({ from, to: to || from })}
          />
          <div className="flex items-center gap-2 pb-1">
            {data?.retentionDays != null && (
              <Badge tone="neutral" title={`Anything older than this has been deleted`}>
                {data.retentionDays} day retention
              </Badge>
            )}
            {data?.minIntervalSeconds != null && (
              <Badge tone="neutral">1 point / {data.minIntervalSeconds}s</Badge>
            )}
            <Button variant="ghost" size="sm" icon={Crosshair} onClick={() => setFitKey(Date.now())}>
              Fit
            </Button>
          </div>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Feature-off and no-movement look identical in the payload — never let
          "breadcrumbs disabled" read as "driver never moved". */}
      {disabled && (
        <Alert tone="info" title="Location trail is switched off">
          Breadcrumbs are disabled on the backend, so no points are being recorded for this driver.
          This does <b>not</b> mean the driver stayed put.
        </Alert>
      )}

      {data?.truncated && (
        <Alert tone="warning" title="Only the first 5000 points are shown">
          The trail is incomplete — narrow the date range.
        </Alert>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : !points.length ? (
        !disabled && (
          <EmptyState
            icon={Route}
            title="No location points in this range"
            description="The driver was not online in this range, or the app sent no location."
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatTile label="Points" value={fmtNum(data.count ?? points.length)} icon={Navigation} tone="navy" />
            <StatTile label="On ride" value={fmtNum(onDutyCount)} sub="solid blue line" icon={Route} />
            <StatTile label="Idle" value={fmtNum(points.length - onDutyCount)} sub="dashed grey line" icon={Route} />
            <StatTile
              label="Avg speed"
              value={(() => {
                const s = points.filter(p => p.speed != null).map(p => p.speed);
                return s.length ? `${fmtDec(s.reduce((a, b) => a + b, 0) / s.length, 1)} km/h` : '—';
              })()}
              icon={Gauge}
            />
          </div>

          <MapView segments={segments} markers={markers} fitKey={fitKey} style={{ height: 520 }} />

          <div className="flex flex-wrap items-center gap-4 px-1 text-[10px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 h-0.5 rounded" style={{ background: ON_DUTY_COLOUR }} /> On a ride (on duty)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 border-t-2 border-dashed" style={{ borderColor: IDLE_COLOUR }} /> Idle / roaming
            </span>
            <span>
              {fmtFull(points[0]?.recordedAt)} → {fmtFull(points[points.length - 1]?.recordedAt)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
