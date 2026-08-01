// Shared vocabulary for the Driver Metrics module — formatters, label maps,
// and the IST date helpers every screen in here needs.
//
// Two rules the backend guide is emphatic about, encoded here once:
//   1. Rate/aggregate `null` means "no data", not 0 — fmtRate renders "—".
//   2. Timestamps already carry the +05:30 offset. We format them *in* IST so
//      an ops person on a laptop with the wrong system clock zone still reads
//      the same wall time the driver experienced.

import {
  CircleDot, Car, Power, LogOut, WifiOff, Timer, MapPinOff, Ban,
  Wallet, Coffee, ShieldAlert, UserX, CheckCircle2, XCircle, Undo2,
  AlarmClock, OctagonPause, Hourglass,
} from 'lucide-react';

export const IST = 'Asia/Kolkata';

// ─── Dates (IST calendar) ────────────────────────────────────────────────────

// en-CA formats as YYYY-MM-DD, which is exactly the shape the API wants.
const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
});

export const istToday = () => ymdFmt.format(new Date());

export const istDaysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return ymdFmt.format(d);
};

/** Inclusive day count between two YYYY-MM-DD strings. */
export const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000) + 1;
};

export const MAX_RANGE_DAYS = 92;

/** Default ranges used across the module, expressed the way the API wants. */
export const defaultRange = (days) => ({ from: istDaysAgo(days - 1), to: istToday() });

// ─── Time formatting ─────────────────────────────────────────────────────────

const dtf = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...opts });

const F_TIME     = dtf({ hour: '2-digit', minute: '2-digit', hour12: false });
const F_DATETIME = dtf({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const F_FULL     = dtf({ day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const F_DAY      = dtf({ day: '2-digit', month: 'short' });

const safe = (iso, fmt) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : fmt.format(d);
};

export const fmtTime     = (iso) => safe(iso, F_TIME);      // 19:31
export const fmtDateTime = (iso) => safe(iso, F_DATETIME);  // 01 Aug, 19:31
export const fmtFull     = (iso) => safe(iso, F_FULL);      // 01 Aug 26, 19:31
export const fmtDayShort = (iso) => safe(iso, F_DAY);       // 01 Aug

/** "2026-07-03" (a plain calendar date, not an instant) → "03 Jul" */
export const fmtYmd = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return String(ymd);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Minutes since an instant — used for the "last ping X min ago" staleness copy. */
export const minutesSince = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

// ─── Durations ───────────────────────────────────────────────────────────────

/** Fallback for the rare payload that carries seconds without a label. */
export const secToLabel = (s) => {
  if (s == null) return '—';
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return `${total}s`;
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Prefer the server's own label; fall back to deriving it from seconds. */
export const fmtDur = (label, seconds) => label || secToLabel(seconds);

// ─── Numbers ─────────────────────────────────────────────────────────────────

// `null` here is "no data", which is a different statement from "0%".
export const fmtRate = (v, suffix = '%') =>
  v == null ? '—' : `${Number(v).toFixed(v % 1 === 0 ? 0 : 2)}${suffix}`;

export const fmtNum = (v, dash = '—') =>
  v == null ? dash : Number(v).toLocaleString('en-IN');

export const fmtDec = (v, digits = 1) =>
  v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtMoney = (v) =>
  v == null ? '—' : '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const fmtKm = (v) => (v == null ? '—' : `${fmtDec(v, 1)} km`);

// ─── Driver status ───────────────────────────────────────────────────────────

export const STATUS_META = {
  available: { label: 'Available', tone: 'success', colour: '#138808', icon: CircleDot },
  on_ride:   { label: 'On ride',   tone: 'info',    colour: '#1e3a8a', icon: Car },
  offline:   { label: 'Offline',   tone: 'neutral', colour: '#8a8176', icon: Power },
};

export const statusMeta = (s) =>
  STATUS_META[s] || { label: s || 'Unknown', tone: 'neutral', colour: '#8a8176', icon: CircleDot };

// Mid grey, not light grey: a disconnected pin must stay readable on pale map
// tiles. "Don't trust this one" is the message, not "hide this one".
export const DISCONNECTED_COLOUR = '#6b7280';

// ─── connection block ────────────────────────────────────────────────────────
// The backend ships a ready-to-display English `message` with every connection
// block. Never hand-write that sentence: it encodes config (staleAfterSeconds,
// whether the duty session was auto-closed) that can change server-side without
// a frontend release.

/** True when the driver's toggle is ON but their app has stopped pinging. */
export const isDisconnected = (connection) =>
  Boolean(connection?.isOnlineButAppDisconnected);

/** Fallback only — prefer `connection.message` wherever it exists. */
export const connectionMessage = (connection) =>
  connection?.message || 'Connection state unknown.';

// ─── Relative time ───────────────────────────────────────────────────────────

// Each step is "how many of this unit before we roll up to the next one".
const RELATIVE_STEPS = [
  [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'],
  [4.34524, 'week'], [12, 'month'], [Infinity, 'year'],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "2 days ago" — what ops actually read in a "last seen" column. An absolute
 * timestamp there makes you do the subtraction in your head on every row.
 */
export const fmtRelative = (iso) => {
  if (!iso) return 'Never';
  const t = Date.parse(iso);
  if (isNaN(t)) return '—';

  let value = (t - Date.now()) / 1000;
  for (const [step, unit] of RELATIVE_STEPS) {
    if (Math.abs(value) < step) return rtf.format(Math.round(value), unit);
    value /= step;
  }
  return rtf.format(Math.round(value), 'year');
};

export const VEHICLE_TYPES = ['bike', 'auto', 'car', 'xl', 'premium', 'luxury'];

export const VEHICLE_OPTS = [
  { value: '', label: 'All vehicles' },
  ...VEHICLE_TYPES.map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
];

// Live map only ever returns online drivers, so its filter is a narrower set
// than the roster's.
export const STATUS_OPTS = [
  { value: '',          label: 'Available + On ride' },
  { value: 'available', label: 'Available only' },
  { value: 'on_ride',   label: 'On ride only' },
];

export const ROSTER_STATUS_OPTS = [
  { value: '',        label: 'All drivers' },
  { value: 'online',  label: 'Online' },
  { value: 'on_ride', label: 'On ride' },
  { value: 'offline', label: 'Offline' },
];

export const VERIFIED_OPTS = [
  { value: '',      label: 'Verified + not' },
  { value: 'true',  label: 'Verified only' },
  { value: 'false', label: 'Unverified only' },
];

export const ROSTER_SORT_OPTS = [
  { value: 'last_seen',    label: 'Last seen' },
  { value: 'online_hours', label: 'Online hours' },
  { value: 'rides',        label: 'Rides' },
  { value: 'earnings',     label: 'Earnings' },
  { value: 'acceptance',   label: 'Acceptance' },
  { value: 'name',         label: 'Name' },
  { value: 'newest',       label: 'Newest' },
];

// ─── Session end reasons ─────────────────────────────────────────────────────
// Involuntary ends (everything except manual/logout) are the interesting ones:
// a cluster of them on one driver usually means a broken phone, not a lazy driver.

export const END_REASON = {
  manual:          { label: 'Driver went offline',     tone: 'neutral', icon: Power },
  logout:          { label: 'Logged out',              tone: 'neutral', icon: LogOut },
  disconnect:      { label: 'Connection dropped',      tone: 'warning', icon: WifiOff },
  stale_timeout:   { label: 'App closed (no ping)',    tone: 'warning', icon: Timer },
  city_drift:      { label: 'Left service area',       tone: 'warning', icon: MapPinOff },
  city_disabled:   { label: 'City / vehicle disabled',  tone: 'warning', icon: Ban },
  cash_limit:      { label: 'Cash limit exceeded',     tone: 'warning', icon: Wallet },
  break_force:     { label: 'Break rule — auto offline', tone: 'danger', icon: Coffee },
  admin_force:     { label: 'Admin forced offline',    tone: 'danger',  icon: ShieldAlert },
  account_deleted: { label: 'Account deleted',         tone: 'danger',  icon: UserX },
};

export const endReasonMeta = (code) =>
  END_REASON[code] || { label: code || '—', tone: 'neutral', icon: Power };

// ─── Break events ────────────────────────────────────────────────────────────

export const BREAK_LEVEL = {
  alert:          { label: 'Break reminder sent', tone: 'warning', icon: AlarmClock },
  force_offline:  { label: 'Auto offline',        tone: 'danger',  icon: OctagonPause },
  force_deferred: { label: 'Offline after ride',  tone: 'warning', icon: Hourglass },
  rest_completed: { label: 'Break completed',     tone: 'success', icon: Coffee },
};

export const breakLevelMeta = (l) =>
  BREAK_LEVEL[l] || { label: l || '—', tone: 'neutral', icon: AlarmClock };

// ─── Timeline events ─────────────────────────────────────────────────────────

export const EVENT_META = {
  online:              { label: 'Went online',        icon: Power,        colour: 'text-green-600',  ring: 'bg-green-50 border-green-200' },
  offline:             { label: 'Went offline',       icon: Power,        colour: 'text-ink-muted',  ring: 'bg-surface-alt border-line' },
  ride_accepted:       { label: 'Ride accepted',      icon: Car,          colour: 'text-blue-600',   ring: 'bg-blue-50 border-blue-200' },
  ride_completed:      { label: 'Ride completed',     icon: CheckCircle2, colour: 'text-green-700',  ring: 'bg-green-50 border-green-200' },
  ride_cancelled:      { label: 'Ride cancelled',     icon: XCircle,      colour: 'text-red-600',    ring: 'bg-red-50 border-red-200' },
  ride_rejected:       { label: 'Ride rejected',      icon: Undo2,        colour: 'text-amber-700',  ring: 'bg-amber-50 border-amber-200' },
  break_alert:         { label: 'Break reminder',     icon: AlarmClock,   colour: 'text-amber-600',  ring: 'bg-amber-50 border-amber-200' },
  break_force_offline: { label: 'Forced offline',     icon: OctagonPause, colour: 'text-red-600',    ring: 'bg-red-50 border-red-200' },
  break_force_deferred:{ label: 'Offline after ride', icon: Hourglass,    colour: 'text-orange-600', ring: 'bg-orange-50 border-orange-200' },
  break_rest_completed:{ label: 'Break completed',    icon: Coffee,       colour: 'text-green-600',  ring: 'bg-green-50 border-green-200' },
};

export const eventMeta = (t) =>
  EVENT_META[t] || { label: (t || 'Event').replace(/_/g, ' '), icon: CircleDot, colour: 'text-ink-muted', ring: 'bg-surface-alt border-line' };

// ─── Misc ────────────────────────────────────────────────────────────────────

// Postgres DOW convention: 0 = Sunday.
export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 18 → "6 PM"; used for the hour histogram and busiest-hour tile. */
export const hourLabel = (h) => {
  const n = Number(h);
  if (isNaN(n)) return '—';
  if (n === 0) return '12 AM';
  if (n === 12) return '12 PM';
  return n < 12 ? `${n} AM` : `${n - 12} PM`;
};

// Break-policy fallbacks for screens that don't load a driver's own policy
// (the live map only gets duty seconds, not the thresholds behind them).
export const DEFAULT_BREAK_POLICY = { alertHours: 6, forceOfflineHours: 7 };

/** amber past the alert threshold, red past the force-offline threshold. */
export const dutyTone = (seconds, policy = DEFAULT_BREAK_POLICY) => {
  if (seconds == null) return null;
  const h = seconds / 3600;
  if (h >= (policy.forceOfflineHours ?? 7)) return 'danger';
  if (h >= (policy.alertHours ?? 6)) return 'warning';
  return null;
};

export const apiError = (e, fallback = 'Something went wrong') => {
  if (e?.response?.status === 403) return 'You do not have access to this module';
  return e?.response?.data?.message || e?.message || fallback;
};
