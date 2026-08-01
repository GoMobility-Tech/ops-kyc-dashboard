import React, { useEffect, useState } from 'react';
import { Clock, Car, Wallet, History } from 'lucide-react';
import { getDriverSessions } from '../../../api/opsApi.js';
import { Card, CardHeader, Alert, Spinner, StatTile, ProgressBar, Badge } from '../../../components/ui';
import { Field } from '../DriverBits.jsx';
import {
  fmtDur, fmtMoney, fmtNum, fmtFull, fmtTime, apiError, endReasonMeta,
  isDisconnected, connectionMessage,
} from '../metricsMeta.js';

/**
 * "How much did they work today" — the first question ops asks — plus the duty/break
 * state that decides whether this driver should still be on the road.
 */
export default function OverviewTab({ driverId, overview: ov }) {
  const [lastSession, setLastSession] = useState(undefined); // undefined = loading
  const [error, setError] = useState('');

  // `currentSession: null` does NOT mean offline. Two very different states
  // produce it, and only `status` tells them apart:
  //
  //   status offline   + no session → driver turned the toggle off themselves
  //   status available + no session → toggle still ON, but the app went silent,
  //                                   so the backend auto-closed the duty session
  //
  // Calling the second one "offline" is exactly the bug that made the list and
  // the detail page look like they disagreed.
  const cs = ov.currentSession;
  const trulyOffline  = ov.status === 'offline';
  const ghostOnline   = !cs && !trulyOffline;
  const noSession     = !cs;

  // With no live session to show, fall back to the one that just ended.
  useEffect(() => {
    if (!noSession) { setLastSession(null); return undefined; }
    let cancelled = false;
    getDriverSessions(driverId, { limit: 1, offset: 0 })
      .then(res => { if (!cancelled) setLastSession(res.data?.data?.items?.[0] || null); })
      .catch(e => { if (!cancelled) { setLastSession(null); setError(apiError(e, 'Failed to load last session')); } });
    return () => { cancelled = true; };
  }, [driverId, noSession]);

  const duty   = ov.duty || {};
  const policy = duty.breakPolicy || {};

  const forceSeconds = (policy.forceOfflineHours ?? 0) * 3600;
  const showBreakBar = policy.enabled && forceSeconds > 0;
  const cont = duty.continuousSeconds || 0;
  const barTone = cont >= forceSeconds ? 'danger'
    : cont >= (policy.alertHours ?? 0) * 3600 ? 'warning'
      : 'success';

  return (
    <div className="space-y-4">
      {error && <Alert tone="warning">{error}</Alert>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatTile
          label="Online today"
          value={fmtDur(ov.today?.onlineLabel, ov.today?.onlineSeconds)}
          sub={ov.today?.onlineHours != null ? `${ov.today.onlineHours} hours` : undefined}
          icon={Clock}
          tone="navy"
        />
        <StatTile
          label="Current session"
          value={cs
            ? fmtDur(cs.durationLabel, cs.durationSeconds)
            : ghostOnline ? 'No open session' : 'Offline'}
          sub={cs
            ? `Started ${fmtTime(cs.startedAt)}`
            : ghostOnline ? 'Toggle is on — app went silent' : 'Driver turned the toggle off'}
          icon={Car}
          tone={cs ? 'success' : ghostOnline ? 'warning' : 'neutral'}
          hint={ghostOnline ? connectionMessage(ov.connection) : undefined}
        />
        <StatTile
          label="Session rides"
          value={cs ? fmtNum(cs.ridesCompleted, '0') : '—'}
          sub={cs ? `${fmtNum(cs.ridesCancelled, '0')} cancelled` : undefined}
          icon={Car}
        />
        <StatTile
          label="Session earnings"
          value={cs ? fmtMoney(cs.earnings) : '—'}
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Duty & break ─────────────────────────────────────────────────── */}
        <Card className="space-y-3">
          <CardHeader
            title="Duty & break"
            subtitle="Continuous driving — safety limit"
            right={policy.enabled === false ? <Badge>Policy off</Badge> : null}
          />

          {showBreakBar ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Continuous duty</span>
                <span className={`font-bold tabular-nums ${
                  barTone === 'danger' ? 'text-red-700' : barTone === 'warning' ? 'text-amber-700' : 'text-ink'}`}>
                  {fmtDur(duty.continuousLabel, duty.continuousSeconds)} / {policy.forceOfflineHours}h
                </span>
              </div>
              <ProgressBar
                value={cont}
                max={forceSeconds}
                tone={barTone}
                marker={(policy.alertHours ?? 0) * 3600}
                markerTitle={`Alert at ${policy.alertHours}h`}
                height={10}
              />
              <p className="text-[10px] text-ink-faint">
                Alert {policy.alertHours}h · Auto offline {policy.forceOfflineHours}h · Min rest {policy.minRestMinutes}m
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">Break policy is off for this driver — no limit tracked.</p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="Streak started" value={duty.streakStartedAt ? fmtFull(duty.streakStartedAt) : '—'} />
            <Field label="Last break" value={duty.lastBreakAt ? fmtFull(duty.lastBreakAt) : '—'} />
            <Field
              label="Pending force offline"
              value={duty.pendingForceOffline ? 'Yes' : 'No'}
              tone={duty.pendingForceOffline ? 'danger' : undefined}
            />
            <Field label="Pending reason" value={duty.pendingReason || '—'} />
          </div>
        </Card>

        {/* ── Session / last session ───────────────────────────────────────── */}
        <Card className="space-y-3">
          <CardHeader
            title={cs ? 'Current session' : 'Last session'}
            subtitle={cs
              ? `Session #${cs.id}`
              : ghostOnline
                ? 'Duty session was auto-closed — the driver is still marked online'
                : 'Driver turned the toggle off'}
            right={cs
              ? <Badge tone="success">Live</Badge>
              : ghostOnline
                ? <Badge tone="warning">No open session</Badge>
                : <Badge>Offline</Badge>}
          />

          {/* Never label this "offline" — the toggle is still on and dispatch
              can still hand this driver a ride. */}
          {ghostOnline && (
            <Alert tone="warning">{connectionMessage(ov.connection)}</Alert>
          )}

          {cs ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Started" value={fmtFull(cs.startedAt)} />
              <Field label="Duration" value={fmtDur(cs.durationLabel, cs.durationSeconds)} />
              <Field label="Rides completed" value={fmtNum(cs.ridesCompleted, '0')} />
              <Field label="Rides cancelled" value={fmtNum(cs.ridesCancelled, '0')} />
              <Field label="Earnings" value={fmtMoney(cs.earnings)} />
              <Field
                label="Active ride"
                value={ov.activeRide?.rideNumber || (ov.activeRide ? `#${ov.activeRide.rideId}` : '—')}
              />
            </div>
          ) : lastSession === undefined ? (
            <div className="py-6 flex justify-center"><Spinner size={16} /></div>
          ) : lastSession ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Started" value={fmtFull(lastSession.startedAt)} />
              <Field label="Ended" value={fmtFull(lastSession.endedAt)} />
              <Field label="Duration" value={fmtDur(lastSession.durationLabel, lastSession.durationSeconds)} />
              <Field
                label="How it ended"
                value={endReasonMeta(lastSession.endReason).label}
                tone={lastSession.wasInvoluntary ? 'danger' : undefined}
                hint={lastSession.wasInvoluntary ? 'The driver did not go offline themselves' : undefined}
              />
              <Field label="Rides" value={`${fmtNum(lastSession.rides?.completed, '0')} completed`} />
              <Field label="Earnings" value={fmtMoney(lastSession.earnings)} />
            </div>
          ) : (
            <p className="text-xs text-ink-faint inline-flex items-center gap-1.5">
              <History size={12} /> No earlier session on record.
            </p>
          )}
        </Card>
      </div>

      {/* ── Profile / device ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Profile" className="mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Driver ID" value={ov.driverId} mono />
          <Field label="User ID" value={ov.userId} mono />
          <Field label="Vehicle" value={ov.vehicle?.number || '—'} mono />
          <Field label="Model" value={ov.vehicle?.model || '—'} />
          <Field label="City" value={ov.city?.name || '—'} />
          <Field
            label="Location"
            value={ov.location
              ? `${Number(ov.location.latitude).toFixed(5)}, ${Number(ov.location.longitude).toFixed(5)}`
              : '—'}
            mono
          />
          <Field
            label="Last ping"
            value={ov.lastPingAt ? fmtFull(ov.lastPingAt) : 'Never'}
            tone={isDisconnected(ov.connection) ? 'danger' : undefined}
            hint={connectionMessage(ov.connection)}
          />
          <Field label="Last login" value={ov.lastLoginAt ? fmtFull(ov.lastLoginAt) : '—'} />
        </div>
      </Card>
    </div>
  );
}
