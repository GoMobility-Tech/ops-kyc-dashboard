import React, { useCallback, useEffect, useState } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDriverTimeline } from '../../../api/opsApi.js';
import { Card, Alert, Spinner, EmptyState, Badge, Button } from '../../../components/ui';
import {
  istToday, eventMeta, endReasonMeta, fmtTime, fmtDur, fmtMoney, fmtKm,
  secToLabel, apiError,
} from '../metricsMeta.js';

const shiftDay = (ymd, delta) => {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (isNaN(t)) return ymd;
  return new Date(t + delta * 86400000).toISOString().slice(0, 10);
};

/** `detail` is shaped per event type, so each type gets its own renderer. */
function EventDetail({ type, detail = {} }) {
  switch (type) {
    case 'online':
      return (
        <span className="text-[11px] text-ink-muted">
          Session #{detail.sessionId}
          {detail.carriedOverFromPreviousDay && (
            <Badge tone="info" className="ml-1.5">Carried over from the previous day</Badge>
          )}
        </span>
      );

    case 'offline': {
      const r = endReasonMeta(detail.reason);
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap text-[11px] text-ink-muted">
          Session #{detail.sessionId} · {secToLabel(detail.durationSeconds)}
          <Badge tone={r.tone} icon={r.icon}>{r.label}</Badge>
        </span>
      );
    }

    case 'ride_accepted':
    case 'ride_cancelled':
    case 'ride_rejected':
      return (
        <span className="text-[11px] text-ink-muted">
          <RideLink detail={detail} />
          {detail.pickup && <> · {detail.pickup}{detail.dropoff ? ` → ${detail.dropoff}` : ''}</>}
          {detail.reason && <> · {detail.reason}</>}
        </span>
      );

    case 'ride_completed':
      return (
        <span className="text-[11px] text-ink-muted">
          <RideLink detail={detail} />
          {detail.fare != null && <> · {fmtMoney(detail.fare)}</>}
          {detail.distanceKm != null && <> · {fmtKm(detail.distanceKm)}</>}
        </span>
      );

    case 'break_alert':
    case 'break_force_offline':
    case 'break_force_deferred':
    case 'break_rest_completed':
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap text-[11px] text-ink-muted">
          Continuous {fmtDur(detail.continuousLabel, detail.continuousSeconds)}
          {detail.acknowledgedAt
            ? <> · acknowledged {fmtTime(detail.acknowledgedAt)}</>
            : type === 'break_alert' && <Badge tone="warning">Driver never saw it</Badge>}
          {Array.isArray(detail.notifiedChannels) && detail.notifiedChannels.length === 0 && (
            <Badge tone="danger">Alert never reached the driver</Badge>
          )}
        </span>
      );

    default:
      return null;
  }
}

/**
 * The API guide wants this to open a ride detail page — this dashboard doesn't
 * have one yet, so the ride number stays a copyable reference instead of a link
 * that goes nowhere. Swap in a <Link> the day that route exists.
 */
function RideLink({ detail }) {
  if (!detail.rideId && !detail.rideNumber) return null;
  return (
    <span
      className="font-mono text-accent-navy font-semibold"
      title={detail.rideId ? `Ride ID ${detail.rideId}` : undefined}
    >
      {detail.rideNumber || `#${detail.rideId}`}
    </span>
  );
}

export default function TimelineTab({ driverId }) {
  const [date, setDate]   = useState(() => istToday());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDriverTimeline(driverId, { date });
      setData(res.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load timeline'));
    } finally {
      setLoading(false);
    }
  }, [driverId, date]);

  useEffect(() => { load(); }, [load]);

  const events = data?.events || [];
  const isToday = date === istToday();

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Day</label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" icon={ChevronLeft} onClick={() => setDate(d => shiftDay(d, -1))} />
              <input
                type="date"
                value={date}
                max={istToday()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink
                  outline-none focus:border-accent-navy focus:ring-2 focus:ring-brand-500/30 transition"
              />
              <Button
                variant="outline"
                size="sm"
                icon={ChevronRight}
                disabled={isToday}
                onClick={() => setDate(d => shiftDay(d, 1))}
              />
            </div>
          </div>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(istToday())}>Today</Button>
          )}
          <span className="text-xs text-ink-muted pb-2 ml-auto">{data?.count ?? 0} events</span>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={Clock} title="No activity on this day" description="Pick another date." />
      ) : (
        <Card>
          <ol className="relative">
            {events.map((ev, i) => {
              const m = eventMeta(ev.type);
              const Icon = m.icon;
              const last = i === events.length - 1;
              return (
                <li key={`${ev.type}-${ev.at}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span className={`w-7 h-7 rounded-full border flex items-center justify-center ${m.ring}`}>
                      <Icon size={13} className={m.colour} />
                    </span>
                    {!last && <span className="w-px flex-1 bg-line my-1" />}
                  </div>

                  <div className={`min-w-0 flex-1 ${last ? '' : 'pb-4'}`}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-ink">{m.label}</span>
                      <span className="text-[11px] text-ink-faint tabular-nums">{fmtTime(ev.at)}</span>
                    </div>
                    <div className="mt-0.5">
                      <EventDetail type={ev.type} detail={ev.detail} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
