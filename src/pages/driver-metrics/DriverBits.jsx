import React from 'react';
import { AlertTriangle, Coffee, Hourglass, FlaskConical, CircleSlash } from 'lucide-react';
import { Badge } from '../../components/ui';
import {
  statusMeta, dutyTone, fmtDur, isDisconnected, connectionMessage,
  DEFAULT_BREAK_POLICY,
} from './metricsMeta.js';

/** Green / blue / grey status pill. */
export function StatusPill({ status, className = '' }) {
  const m = statusMeta(status);
  return <Badge tone={m.tone} icon={m.icon} className={className}>{m.label}</Badge>;
}

/**
 * "Toggle is ON but the app stopped pinging" — the driver still shows as online
 * and still takes dispatch, but their location and availability can't be trusted.
 *
 * The tooltip is always `connection.message` verbatim. That sentence encodes
 * server config (the staleness window, whether the duty session was auto-closed);
 * paraphrasing it here would go stale the moment ops change a setting.
 */
export function ConnectionTag({ connection }) {
  if (!isDisconnected(connection)) return null;
  const mins = connection?.secondsSinceLastPing != null
    ? Math.round(connection.secondsSinceLastPing / 60)
    : null;
  return (
    <Badge tone="warning" icon={AlertTriangle}>
      <span title={connectionMessage(connection)}>
        App not responding{mins != null ? ` · ${mins}m` : ''}
      </span>
    </Badge>
  );
}

/**
 * Registered and often verified, but never once went on duty. A different
 * problem from "did nothing this week" — this one is onboarding drop-off.
 */
export function NeverOnlineBadge({ show }) {
  if (!show) return null;
  return (
    <Badge tone="neutral" icon={CircleSlash}>
      <span title="This driver has never gone on duty since signing up">Never online</span>
    </Badge>
  );
}

/**
 * Continuous-duty badge. Silent while the driver is within policy — this is a
 * safety signal, not a running counter that cries wolf every shift.
 */
export function DutyBadge({ seconds, label, policy = DEFAULT_BREAK_POLICY }) {
  const tone = dutyTone(seconds, policy);
  if (!tone) return null;
  return (
    <Badge tone={tone} icon={Coffee}>
      {tone === 'danger' ? 'Over limit' : 'Break due'} · {fmtDur(label, seconds)}
    </Badge>
  );
}

/** Force-offline is queued and will fire the moment the current ride ends. */
export function PendingOfflineBadge({ show, reason }) {
  if (!show) return null;
  return (
    <Badge tone="warning" icon={Hourglass}>
      <span title={reason || 'Break limit crossed — will go offline as soon as the ride ends'}>
        Offline after ride
      </span>
    </Badge>
  );
}

export function TestTag({ show }) {
  if (!show) return null;
  return <Badge tone="warning" icon={FlaskConical}>TEST</Badge>;
}

/** Label-over-value pair used across every tab. */
export function Field({ label, value, mono = false, tone, hint, className = '' }) {
  const empty = value == null || value === '' || value === '—';
  return (
    <div className={className} title={hint}>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</p>
      <p className={`text-xs font-medium break-words leading-snug
        ${empty ? 'text-ink-faint' : tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-green-700' : 'text-ink'}
        ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

/** A driver can hold several categories at once — never render types as a string. */
export function VehicleTypes({ types = [], number }) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {number && <span className="font-mono text-xs text-ink">{number}</span>}
      {types.map(t => (
        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt border border-line text-ink-muted uppercase">
          {t}
        </span>
      ))}
    </span>
  );
}
