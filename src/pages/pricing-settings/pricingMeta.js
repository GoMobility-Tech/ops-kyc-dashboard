// ─── Pricing Settings — field specs and shared helpers ───────────────────────
//
// Everything on this screen writes to LIVE pricing. Two backend rules shape how
// the forms here behave, and both are worth knowing before changing anything:
//
//   1. Unknown field names are REJECTED with a 400, not stripped. That is
//      deliberate — the backend used to strip them, which turned a misspelled
//      field into a save that returned 200 and changed nothing. So a form may
//      only ever send keys listed in the specs below.
//
//   2. A row comes back from the API with columns that are not writable
//      (`id`, `updated_at`, `vehicle_type`…). Posting the whole row back would
//      therefore 400 on the first read-only column. Every save on this screen
//      sends a DIFF — only the fields the person actually touched.
//
// The `settings` tab is different: it renders itself from the backend's own
// field catalog (GET /settings/meta), so a new pricing setting appears here
// with no frontend release. Nothing about it is hardcoded in this file.

// ─── Formatting ─────────────────────────────────────────────────────────────

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const fmtRupees = (v) => {
  const n = num(v);
  return n === null ? '—' : `₹${n.toFixed(2)}`;
};

export const fmtWhen = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// The two "disable by very large number" sentinels. Migration 071 set both to
// 999999 on every vehicle, and there is no separate off switch — a huge number
// IS the off switch. Showing "999999.00" in a rupee column reads like a bug, so
// it is labelled for what it means.
export const SENTINEL = 999999;
export const isOff = (v) => num(v) !== null && num(v) >= SENTINEL;

// ─── Diff ───────────────────────────────────────────────────────────────────
//
// Only the touched fields, coerced to the type the validator expects. HTML
// inputs hand back strings, and the backend's number ranges are checked with
// Joi, so "12.5" has to become 12.5 before it goes out.
// "50.00" and "50" are the same fare. NUMERIC columns come back from Postgres
// as strings with trailing zeros, while an untouched input hands back whatever
// was typed — so a plain string compare marks every numeric field as changed
// and an untouched form POSTs the entire row. That is not just noise: it writes
// an audit entry per field and re-saves values nobody looked at.
//
// Empty is its own case. The draft seeds a null column as '', so '' and null
// have to count as equal or clearing nothing looks like clearing something.
const sameValue = (before, after, type) => {
  const beforeEmpty = before === null || before === undefined || before === '';
  const afterEmpty  = after  === null || after  === undefined || after  === '';
  if (beforeEmpty || afterEmpty) return beforeEmpty && afterEmpty;
  if (type === 'number')  return Number(before) === Number(after);
  if (type === 'boolean') return Boolean(before) === Boolean(after);
  return String(before) === String(after);
};

export const buildPatch = (draft, original, fields) => {
  const patch = {};
  for (const f of fields) {
    const before = original?.[f.key];
    const after  = draft?.[f.key];

    // An untouched field is skipped even when its value is falsy — `0` and
    // `false` are real values here (a zero platform fee, a switched-off row).
    if (after === undefined) continue;

    let value = after;
    if (f.type === 'number') {
      if (after === '' || after === null) {
        // Null is meaningful on several columns: a null surge_cap means "use
        // the global cap", a null max_km is the open-ended top tier. Where it
        // is not allowed, an empty box means "unchanged" rather than zero —
        // sending 0 would quietly make a ride free.
        if (!f.nullable) continue;
        value = null;
      } else {
        value = Number(after);
        if (!Number.isFinite(value)) continue;
      }
    }
    if (f.type === 'boolean') value = Boolean(after);
    if (f.type === 'text' && value === '') value = f.nullable ? null : '';

    if (!sameValue(before, value, f.type)) patch[f.key] = value;
  }
  return patch;
};

// ─── Vehicles ───────────────────────────────────────────────────────────────
// Grouped the way a founder thinks about a fare, not the way the table stores
// it. Every key here exists in the backend's vehiclePatchSchema.

export const VEHICLE_GROUPS = [
  {
    title: 'Fare',
    help: 'What the rider pays before surge, GST and fees.',
    fields: [
      { key: 'base_fare',    label: 'Base fare',    type: 'number', unit: '₹', min: 0, max: 10000, step: 0.5 },
      { key: 'per_km_rate',  label: 'Per km',       type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5 },
      { key: 'minimum_fare', label: 'Minimum fare', type: 'number', unit: '₹', min: 0, max: 10000, step: 0.5,
        help: 'A ride never bills below this, however short.' },
      { key: 'per_km_rate_10_20', label: 'Per km, 10–20 km', type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5,
        nullable: true, help: 'Blank falls back to the normal per-km rate.' },
      { key: 'per_km_rate_20_plus', label: 'Per km, 20 km+', type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5,
        nullable: true, help: 'Blank falls back to the normal per-km rate.' },
    ],
  },
  {
    title: 'Convenience fee',
    help: 'The platform’s cut shown to the rider as a separate line. Stored per vehicle in its own table, edited here.',
    fields: [
      { key: 'off_peak_base', label: 'Off-peak', type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5, convenience: true },
      { key: 'peak_base',     label: 'Peak',     type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5, convenience: true },
    ],
  },
  {
    title: 'Platform fee',
    fields: [
      { key: 'platform_fee',           label: 'Platform fee',   type: 'number', unit: '₹', min: 0, max: 1000, step: 0.5 },
      { key: 'platform_fee_daily_cap', label: 'Daily cap',      type: 'number', unit: 'rides', min: 0, max: 1000, step: 1,
        help: 'After this many rides in a day the driver stops paying it.' },
    ],
  },
  {
    title: 'Pickup and waiting',
    fields: [
      { key: 'pickup_free_km',        label: 'Free pickup distance', type: 'number', unit: 'km',    min: 0, max: 100, step: 0.5 },
      { key: 'pickup_rate_per_km',    label: 'Pickup beyond that',   type: 'number', unit: '₹/km',  min: 0, max: 1000, step: 0.5 },
      { key: 'waiting_grace_minutes', label: 'Free waiting',         type: 'number', unit: 'min',   min: 0, max: 120, step: 1 },
      { key: 'waiting_rate_per_min',  label: 'Waiting charge',       type: 'number', unit: '₹/min', min: 0, max: 100, step: 0.5 },
      { key: 'wait_charge_cap',       label: 'Waiting cap',          type: 'number', unit: '₹',     min: 0, max: 1000000, step: 1,
        help: '999999 means no cap — that is how the feature is switched off.' },
      { key: 'traffic_grace_minutes', label: 'Traffic grace',        type: 'number', unit: 'min',   min: 0, max: 240, step: 1 },
      { key: 'traffic_rate_per_min',  label: 'Traffic charge',       type: 'number', unit: '₹/min', min: 0, max: 100, step: 0.5 },
    ],
  },
  {
    title: 'Ride behaviour',
    fields: [
      { key: 'avg_speed_kmph',      label: 'Assumed speed',     type: 'number', unit: 'km/h', min: 1, max: 120, step: 1,
        help: 'Used to turn distance into an expected trip time.' },
      { key: 'night_multiplier',    label: 'Night multiplier',  type: 'number', unit: '×', min: 1, max: 5, step: 0.05,
        help: '1.25 means 25 percent extra during the night window.' },
      { key: 'surge_cap',           label: 'Surge cap',         type: 'number', unit: '×', min: 1, max: 5, step: 0.05,
        nullable: true, help: 'Blank means the global surge cap applies.' },
      { key: 'max_pickup_radius_km', label: 'Max pickup radius', type: 'number', unit: 'km', min: 0, max: 100, step: 0.5,
        nullable: true, help: 'Blank means dispatch uses its own default.' },
      { key: 'auto_cancel_minutes', label: 'Auto-cancel after', type: 'number', unit: 'min', min: 1, max: 1000000, step: 1,
        help: '999999 means auto-cancel is off.' },
    ],
  },
  {
    title: 'Category rules',
    help: 'Who is allowed to drive this category. Not part of the fare.',
    fields: [
      { key: 'display_name',   label: 'Display name', type: 'text' },
      { key: 'vehicle_class',  label: 'Class',        type: 'select',
        options: [
          { value: 'two_wheel',  label: 'Two wheeler' },
          { value: 'three_wheel', label: 'Three wheeler' },
          { value: 'car_side',   label: 'Car' },
        ] },
      { key: 'max_vehicle_age_years', label: 'Max vehicle age', type: 'number', unit: 'years', min: 0, max: 50, step: 1, nullable: true },
      { key: 'min_engine_cc',         label: 'Min engine',      type: 'number', unit: 'cc',    min: 0, max: 10000, step: 10, nullable: true },
      { key: 'ac_required',           label: 'AC required',     type: 'boolean' },
      { key: 'category_notes',        label: 'Notes',           type: 'text', nullable: true },
      { key: 'sort_order',            label: 'Sort order',      type: 'number', min: 0, max: 1000, step: 1,
        help: 'Lower numbers appear first in the rider app.' },
      { key: 'is_active',             label: 'Available to book', type: 'boolean',
        help: 'Off hides the category from the rider app without losing its pricing.' },
    ],
  },
];

export const VEHICLE_FIELDS = VEHICLE_GROUPS.flatMap(g => g.fields);

// `convenience` lives in its own table and the backend takes it as a nested
// object, so it is split out of the flat patch at save time.
export const splitVehiclePatch = (patch) => {
  const convKeys = VEHICLE_FIELDS.filter(f => f.convenience).map(f => f.key);
  const out = {};
  const convenience = {};
  for (const [k, v] of Object.entries(patch)) {
    if (convKeys.includes(k)) convenience[k] = v;
    else out[k] = v;
  }
  if (Object.keys(convenience).length) out.convenience = convenience;
  return out;
};

// ─── Distance tiers ─────────────────────────────────────────────────────────
// `description` is in the backend schema but there is no such column in
// pricing_distance_tiers, so it is deliberately not offered here.
export const TIER_FIELDS = [
  { key: 'min_km',     label: 'From', type: 'number', unit: 'km', min: 0, max: 10000, step: 0.5 },
  { key: 'max_km',     label: 'To',   type: 'number', unit: 'km', min: 0, max: 10000, step: 0.5,
    nullable: true, help: 'Blank is the open-ended top band.' },
  { key: 'multiplier', label: 'Multiplier', type: 'number', unit: '×', min: 0.01, max: 5, step: 0.05 },
  { key: 'sort_order', label: 'Order', type: 'number', min: 0, max: 1000, step: 1 },
  { key: 'is_active',  label: 'Active', type: 'boolean' },
];

// ─── GO Pass (subscriber rules) ─────────────────────────────────────────────
export const SUBSCRIBER_FIELDS = [
  { key: 'display_label',          label: 'Shown as',          type: 'text', nullable: true },
  { key: 'monthly_price',          label: 'Monthly price',     type: 'number', unit: '₹', min: 0, max: 100000, step: 1 },
  { key: 'free_km',                label: 'Free km per ride',  type: 'number', unit: 'km', min: 0, max: 1000, step: 0.5 },
  { key: 'discount_pct_beyond',    label: 'Discount beyond that', type: 'number', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'surge_cap',              label: 'Surge cap',         type: 'number', unit: '×', min: 1, max: 5, step: 0.05 },
  { key: 'free_rides_per_day',     label: 'Free rides / day',   type: 'number', min: 0, max: 100, step: 1 },
  { key: 'free_rides_per_month',   label: 'Free rides / month', type: 'number', min: 0, max: 3000, step: 1 },
  { key: 'surge_protection_rides', label: 'Surge-protected rides', type: 'number', min: 0, max: 3000, step: 1,
    help: 'How many rides a month are priced without surge.' },
  { key: 'is_active',              label: 'On sale',            type: 'boolean' },
];

// ─── GST ────────────────────────────────────────────────────────────────────
export const GST_FIELDS = [
  { key: 'gst_enabled',          label: 'GST on',              type: 'boolean',
    help: 'Off removes GST from every quote and invoice.' },
  { key: 'rider_rate_pct',       label: 'Rider GST',           type: 'number', unit: '%', min: 0, max: 100, step: 0.5 },
  { key: 'platform_rate_pct',    label: 'Platform GST',        type: 'number', unit: '%', min: 0, max: 100, step: 0.5 },
  { key: 'conv_fee_gst_pct',     label: 'Convenience fee GST', type: 'number', unit: '%', min: 0, max: 100, step: 0.5 },
  { key: 'subscription_gst_pct', label: 'GO Pass GST',         type: 'number', unit: '%', min: 0, max: 100, step: 0.5 },
  { key: 'wallet_topup_gst_pct', label: 'Wallet top-up GST',   type: 'number', unit: '%', min: 0, max: 100, step: 0.5 },
  { key: 'auto_gst_exempt',      label: 'Autos exempt',        type: 'boolean',
    help: 'Auto rides are GST exempt by government rule. Editable because the rule can change — not something to flip casually.' },
  { key: 'rider_sac_code',       label: 'Rider SAC',           type: 'text' },
  { key: 'platform_sac_code',    label: 'Platform SAC',        type: 'text' },
  { key: 'conv_sac_code',        label: 'Convenience SAC',     type: 'text' },
  { key: 'gst_registration_no',  label: 'GSTIN',               type: 'text', nullable: true },
];

// ─── Penalties ──────────────────────────────────────────────────────────────
export const PENALTY_FIELDS = [
  { key: 'penalty_amount',         label: 'Penalty',          type: 'number', unit: '₹', min: 0, max: 100000, step: 10 },
  { key: 'rider_refund_amount',    label: 'Rider refund',     type: 'number', unit: '₹', min: 0, max: 100000, step: 10 },
  { key: 'suspension_days',        label: 'Suspension',       type: 'number', unit: 'days', min: 0, max: 3650, step: 1 },
  { key: 'escalation_window_days', label: 'Escalation window', type: 'number', unit: 'days', min: 1, max: 3650, step: 1,
    help: 'Offences inside this window count towards the next step.' },
  { key: 'requires_rekyc',         label: 'Re-KYC required',  type: 'boolean' },
  { key: 'is_permanent_ban',       label: 'Permanent ban',    type: 'boolean' },
  { key: 'action_notes',           label: 'Notes',            type: 'text', nullable: true },
  { key: 'is_active',              label: 'Active',           type: 'boolean' },
];

// ─── Audit ──────────────────────────────────────────────────────────────────
export const AUDIT_SCOPES = [
  { value: '',           label: 'Everything' },
  { value: 'vehicle',    label: 'Vehicles' },
  { value: 'setting',    label: 'Settings' },
  { value: 'gst',        label: 'GST' },
  { value: 'tier',       label: 'Distance tiers' },
  { value: 'subscriber', label: 'GO Pass' },
  { value: 'penalty',    label: 'Penalties' },
];

// The write endpoints all return this. `all_servers: false` means the value is
// saved and live on the server that answered, but the others could not be told
// — so a quote from another worker can still use the old number.
export const cacheWarning = (res) => {
  const cache = res?.data?.data?.cache;
  if (!cache || cache.all_servers !== false) return null;
  return cache.note || 'Saved, but the other API servers could not be told. Press Reload Cache.';
};

// ─── Why a section did not load ─────────────────────────────────────────────
//
// Takes a Promise.allSettled result and returns the line to show, or null when
// it loaded. This exists as its own function because the first version of the
// page had no equivalent: every rejection became an empty object, so a 403 on
// the GST endpoint rendered as a blank form with "GST on" switched off — while
// production had GST on at 5 percent. A blank pricing form does not read as an
// error, it reads as a setting, which is the one thing this screen must never
// get wrong.
//
// The 403 is called out separately because it has a specific cause that the
// person can act on: the Pricing Settings module can be granted to an ops_team
// account, but six of the seven endpoints behind this screen also require the
// admin role. Granting the module alone produces exactly one working tab.
export const describeFailure = (result) => {
  if (!result || result.status !== 'rejected') return null;
  if (result.reason?.response?.status === 403) {
    return 'Your account can open this screen but is not allowed to read this '
         + 'section. These endpoints want the admin role, not just the '
         + 'Pricing Settings grant.';
  }
  return result.reason?.response?.data?.message
    || result.reason?.message
    || 'Could not load this section.';
};
