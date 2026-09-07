// Dispatch Visibility — shared metadata and formatters.
//
// Backend guide: gomobility-backend/docs/22_DISPATCH_VISIBILITY_FRONTEND.md
//
// This module is READ-ONLY. No ride is assigned or forced from here — the
// backend has no such endpoint. Do not add an "Assign driver" button.

import {
  Radio, Waypoints, LogIn, Clock, CheckCircle2, XCircle, CircleSlash,
} from 'lucide-react';

// ── NUMERIC → number ────────────────────────────────────────────────────────
// Postgres NUMERIC columns arrive from node-postgres as STRINGS
// (estimated_fare, distance_km, radius_km, latitude, longitude). Calling
// .toFixed() or doing arithmetic on them straight gives wrong output or throws,
// so every numeric value goes through here first.
export const num = (v) => {
  // The typeof guard matters: Number([]) === 0 and Number(true) === 1. Without
  // it an empty array silently renders as "0 km" — bad data looking like truth.
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Distance / radius to one decimal. null → em dash.
export const fmtKm = (v) => {
  const n = num(v);
  return n == null ? '—' : `${n.toFixed(1)} km`;
};

export const fmtRupees = (v) => {
  const n = num(v);
  return n == null ? '—' : `₹${n.toFixed(2)}`;
};

export const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return iso; }
};

export const fmtClock = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return iso; }
};

// ── How the request reached the driver ──────────────────────────────────────
// Requests go out through three different paths. The difference matters to
// support: late_online means the driver only came online after the ride was
// already waiting.
export const SOURCE_META = {
  initial: {
    label: 'Initial',
    tone: 'navy',
    icon: Radio,
    why: 'First broadcast the moment the ride was booked (tier 0).',
  },
  tier_expansion: {
    label: 'Ring expand',
    tone: 'info',
    icon: Waypoints,
    why: 'Found after 60s when dispatch widened the search radius.',
  },
  late_online: {
    label: 'Late online',
    tone: 'brand',
    icon: LogIn,
    why: 'Driver came online (or entered the area) while the ride was already waiting.',
  },
};

export const sourceMeta = (s) => SOURCE_META[s] || {
  label: String(s || '—').replace(/_/g, ' '),
  tone: 'neutral', icon: null, why: '',
};

// ── What the driver did about it ────────────────────────────────────────────
// `pending` means they have not responded at all. These are the drivers
// support should be calling.
export const OUTCOME_META = {
  pending: {
    label: 'No response',
    tone: 'warning',
    icon: Clock,
    why: 'Request sent, driver has not responded yet. Call these drivers.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'success',
    icon: CheckCircle2,
    why: 'This driver took the ride.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    icon: XCircle,
    why: 'Driver declined (or the auto-reject timeout fired).',
  },
  expired: {
    label: 'Expired',
    tone: 'neutral',
    icon: CircleSlash,
    why: 'Another driver took the ride, or the ride itself expired.',
  },
};

export const outcomeMeta = (o) => OUTCOME_META[o] || {
  label: String(o || '—'), tone: 'neutral', icon: null, why: '',
};

// ── How long the passenger has been waiting ─────────────────────────────────
// The most important column on the list — support decides who to look at first
// from this. Thresholds come from dispatch's own timing: ring expansion runs at
// 60s and the last tier finishes around the 2 minute mark, so anything past 5
// minutes means the whole dispatch cycle came up empty.
export const WAIT_WARN_MIN = 3;
export const WAIT_CRIT_MIN = 5;

// The detail screen opens for any ride, not only waiting ones. On a ride that
// already matched, `waiting_minutes` means something different — not "still
// waiting" but "how long it took to match". Painting that red would send the
// wrong signal: that ride did get its driver.
export const isSearching = (status) => status === 'requested';

export const waitLabel = (status) => (isSearching(status) ? 'Waiting' : 'Time to match');

export const waitTone = (mins, status = 'requested') => {
  // Driver already found — the wait is history now, not a problem.
  if (!isSearching(status)) return 'neutral';
  const n = num(mins) ?? 0;
  if (n >= WAIT_CRIT_MIN) return 'danger';
  if (n >= WAIT_WARN_MIN) return 'warning';
  return 'neutral';
};

export const fmtWait = (mins) => {
  const n = num(mins);
  if (n == null) return '—';
  // Negatives are possible: the detail query computes
  // `COALESCE(driver_assigned_at, NOW()) - requested_at`, so odd data (or clock
  // skew) can push it below zero. "-501m" looks broken on screen — 0 is honest.
  if (n < 0) return '0m';
  if (n < 60) return `${n}m`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
};

// Phone as a tel: link. Backend sends 10 digits; prefixing +91 makes it work
// from a desktop softphone as well as a mobile.
export const telHref = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `tel:${digits.length === 10 ? `+91${digits}` : `+${digits}`}`;
};

// Only the drivers who have not responded yet.
export const pendingOffers = (offers = []) =>
  offers.filter(o => o.outcome === 'pending');

// ── History filters ─────────────────────────────────────────────────────────
// Ride statuses, from the rides table CHECK constraint.
export const STATUS_FILTERS = [
  { value: '',          label: 'Any status' },
  { value: 'requested', label: 'Still searching' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired',   label: 'Expired' },
];

export const DAY_FILTERS = [
  { value: '1',  label: 'Last 24 hours' },
  { value: '3',  label: 'Last 3 days' },
  { value: '10', label: 'Last 10 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export const STATUS_TONE = {
  requested: 'warning',
  accepted:  'info',
  completed: 'success',
  cancelled: 'danger',
  expired:   'neutral',
};

export const statusTone = (s) => STATUS_TONE[s] || 'neutral';
