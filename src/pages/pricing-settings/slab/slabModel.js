// ─── Distance slabs — pure model (no React, no network) ──────────────────────
//
// The backend stores a slab set as a flat list of rules, ONE ROW PER COMPONENT
// PER DISTANCE RANGE:
//
//     { component: 'base' | 'distance' | 'conv', min_km, max_km (null = open),
//       mode: 'fixed' | 'percent' | 'per_km', value, ref_kind, ref_amount }
//
// A person does not think like that. They think in a ladder:
//
//     0 – 3.5 km     base —      distance ₹95 fixed    conv ₹7 fixed
//     3.5 – 5 km     base 40%…   distance ₹15 / km     conv 22%…
//
// So the screen edits a LADDER (one row per distance range, three cells per
// row) and this file converts both ways. The backend stays the judge of what is
// valid (gaps, overlaps, starting at 0, all three components) — the checks here
// only exist so a row can be marked red BEFORE a round trip, never to replace it.
//
// How a ride is priced from a set (backend `slabPricingEngine`):
//   • the slab is picked by the ride's TOTAL km — the whole ride is charged at
//     that slab's rates, not progressively (a 7 km ride at ₹15/km = ₹105)
//   • a range covers (min, max]: 3.5 km still belongs to the 0–3.5 slab, 3.6 km
//     to the next one; 0 km is included in the first
//   • km beyond the last closed slab → the old pricing engine

export const COMPONENTS = ['base', 'distance', 'conv'];
// Optional 4th part (backend mig 141): the lowest ride fare, applied AFTER surge.
// "No minimum" is a perfectly normal value, unlike the three above which must be chosen.
export const FLOOR = 'floor';
export const ALL_COMPONENTS = [...COMPONENTS, FLOOR];

export const COMPONENT_LABEL = {
  base:     'Base fare',
  distance: 'Distance fare',
  conv:     'Convenience fee',
  floor:    'Minimum fare',
};

// Minimum fare has its own two choices — "no minimum" or one flat amount.
export const FLOOR_OPTIONS = [
  { value: 'none',  label: 'No minimum' },
  { value: 'fixed', label: 'Flat minimum (₹)' },
];
export const FLOOR_HELP = 'The ride fare never goes below this. It is applied after surge, like the old minimum fare.';

export const BAND_LABEL = { off_peak: 'Off-peak', peak: 'Peak', night: 'Night' };

export const BAND_HELP = {
  off_peak: 'Normal hours. The old 50% off-peak base discount is NOT applied on top of slab amounts.',
  peak:     'Peak hours. Surge still applies on top of these amounts.',
  night:    'Night hours. Enter the final night amounts — the 1.25× night multiplier is NOT applied on top.',
};

export const SCOPE_LABEL = { global: 'All cities', state: 'State', city: 'City' };

// 'none' is not a backend mode — it is "fixed ₹0", given its own word because
// "base fare: fixed 0" reads like a mistake while "None" reads like a decision.
export const MODE_OPTIONS = [
  { value: '',        label: 'Choose how to charge…' },
  { value: 'fixed',   label: 'Flat amount (₹)' },
  { value: 'per_km',  label: 'Rate per km (₹ × km)' },
  { value: 'percent', label: 'Percentage of an amount (%)' },
  { value: 'none',    label: 'Not charged (₹0)' },
];

// One plain sentence under each choice, so nobody has to guess what it does.
export const MODE_HELP = {
  fixed:   'The same amount for every trip in this slab, however long it is.',
  per_km:  'Rate × the trip\u2019s total km. 7 km at ₹15 = ₹105.',
  percent: 'This % of the amount on the right. Leave that amount empty to use the vehicle\u2019s base fare.',
  none:    'Nothing is charged for this part in this slab.',
};

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// ₹95 · ₹17.6 · ₹0.5 — no trailing zeros, at most 2 decimals.
export const money = (v) => {
  const x = num(v);
  if (x === null) return '—';
  return `₹${Number(x.toFixed(2))}`;
};

export const plain = (v) => {
  const x = num(v);
  return x === null ? '' : String(Number(x.toFixed(4)));
};

// ─── Ladder ─────────────────────────────────────────────────────────────────
//
// row = { id, from (derived), to ('' = open-ended), cells: { base, distance, conv } }
// cell = { mode: '' | 'none' | 'fixed' | 'per_km' | 'percent', value: '', ref: '' }
//   `ref` is the "% of ₹…" amount; empty means "% of the vehicle's base fare".

let seq = 0;
const rowId = () => `row-${++seq}`;

// `offset` is the fixed ₹ added to a per-km rate (can be negative): ₹16/km − ₹10.
// It exists because the old pricing charged progressively (₹15 for the first 10 km,
// ₹16 after), which as "whole trip at the slab's rate" needs that correction.
export const emptyCell = () => ({ mode: '', value: '', ref: '', offset: '' });
const noFloor = () => ({ mode: 'none', value: '', ref: '', offset: '' });

export const emptyRow = (to = '') => ({
  id: rowId(), from: 0, to,
  cells: { base: emptyCell(), distance: emptyCell(), conv: emptyCell(), floor: noFloor() },
});

// `from` is never typed — it is the previous row's `to`, so a gap or an overlap
// between two rows cannot be drawn in the first place.
export const normalizeLadder = (rows) => rows.map((r, i) => ({
  ...r,
  from: i === 0 ? 0 : num(rows[i - 1].to),
}));

export const blankLadder = () => normalizeLadder([emptyRow('')]);

const cellFromRule = (r, component) => {
  if (!r) return component === FLOOR ? noFloor() : emptyCell();
  const value = num(r.value);
  if (component === FLOOR) return { mode: 'fixed', value: plain(value), ref: '', offset: '' };
  if (r.mode === 'fixed' && value === 0) return { mode: 'none', value: '', ref: '', offset: '' };
  if (r.mode === 'percent') {
    const ref = r.ref_kind === 'amount' ? num(r.ref_amount) : null;
    return { mode: 'percent', value: plain(value), ref: ref === null ? '' : plain(ref), offset: '' };
  }
  const off = r.mode === 'per_km' ? num(r.offset_amount) : null;
  return { mode: r.mode, value: plain(value), ref: '', offset: off ? plain(off) : '' };
};

/**
 * Backend rule rows → ladder.
 *
 * The three components do not have to share boundaries (distance may change at
 * 3.5 km while base changes at 5). The ladder uses the UNION of all boundaries,
 * so each row is a range in which every component has exactly one rule.
 * A component with no rule for a range gets an empty cell, which the validation
 * then flags — a stored set with a hole shows the hole instead of hiding it.
 */
export const rulesToLadder = (rules) => {
  const rs = (rules || []).map(r => ({ ...r, _min: num(r.min_km) ?? 0, _max: num(r.max_km) }));
  if (rs.length === 0) return blankLadder();

  const points = [...new Set([
    ...rs.map(r => r._min),
    ...rs.filter(r => r._max !== null).map(r => r._max),
  ])].sort((a, b) => a - b);
  const anyOpen = rs.some(r => r._max === null);

  const spans = [];
  if (points[0] > 0) spans.push({ from: 0, to: points[0] });
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = i + 1 < points.length ? points[i + 1] : null;
    if (to === null && !anyOpen) break;
    spans.push({ from, to });
  }

  const rows = spans.map(({ from, to }) => {
    const cells = {};
    const hasFloor = rs.some(r => r.component === FLOOR);
    for (const c of ALL_COMPONENTS) {
      const rule = rs.find(r => r.component === c && r._min <= from
        && (r._max === null || (to !== null && r._max >= to)));
      // A set with NO floor rows simply has no minimum. A set WITH floor rows but a hole shows the hole.
      cells[c] = (c === FLOOR && !hasFloor) ? noFloor() : cellFromRule(rule, c);
    }
    return { id: rowId(), from, to: to === null ? '' : plain(to), cells };
  });
  return normalizeLadder(rows);
};

const sameRule = (a, b) => a.mode === b.mode && a.value === b.value
  && a.ref_kind === b.ref_kind && a.ref_amount === b.ref_amount
  && (a.offset_amount || 0) === (b.offset_amount || 0);

export const cellToRule = (cell, component = null) => {
  const base = { ref_kind: 'vehicle_base_fare', ref_amount: null, offset_amount: 0 };
  // No minimum fare = no floor rule at all (not "floor of ₹0").
  if (component === FLOOR) return cell?.mode === 'fixed' ? { mode: 'fixed', value: num(cell.value), ...base } : null;
  switch (cell?.mode) {
    case 'none':    return { mode: 'fixed', value: 0, ...base };
    case 'fixed':   return { mode: 'fixed', value: num(cell.value), ...base };
    case 'per_km':  return { mode: 'per_km', value: num(cell.value), ...base, offset_amount: num(cell.offset) ?? 0 };
    case 'percent': {
      const ref = num(cell.ref);
      return {
        mode: 'percent', value: num(cell.value),
        ref_kind: ref === null ? 'vehicle_base_fare' : 'amount',
        ref_amount: ref,
      };
    }
    default:        return null;
  }
};

/**
 * Ladder → backend rows. Neighbouring ranges that end up with the identical rule
 * for a component are joined (₹15/km on 3.5–5 and on 5–10 is stored as one
 * 3.5–10 rule): the price is the same, and the audit trail stays readable.
 */
export const ladderToRules = (ladder) => {
  const out = [];
  for (const component of ALL_COMPONENTS) {
    for (const row of ladder) {
      const rule = cellToRule(row.cells[component], component);
      if (!rule) continue;
      const from = num(row.from) ?? 0;
      const to = num(row.to);
      const last = out[out.length - 1];
      if (last && last.component === component && last.max_km === from && sameRule(last, rule)) {
        last.max_km = to;
        continue;
      }
      out.push({ component, min_km: from, max_km: to, ...rule });
    }
  }
  return out;
};

/**
 * Client-side checks. { ok, errors: [string], rowErrors: { [rowId]: [string] } }
 * Mirrors what the backend will refuse, in words about the row the person is
 * looking at rather than about rule indexes.
 */
export const validateLadder = (ladder) => {
  const errors = [];
  const rowErrors = {};
  const add = (row, msg) => { (rowErrors[row.id] ||= []).push(msg); };

  if (!ladder || ladder.length === 0) {
    return { ok: false, errors: ['Add at least one slab.'], rowErrors };
  }

  ladder.forEach((row, i) => {
    const last = i === ladder.length - 1;
    const from = num(row.from);
    const to = num(row.to);
    const label = `Slab ${i + 1}`;

    if (row.to === '' || row.to === null || row.to === undefined) {
      if (!last) add(row, `${label}: only the last slab can be open-ended.`);
    } else if (to === null) {
      add(row, `${label}: "to" is not a number.`);
    } else if (from !== null && to <= from) {
      add(row, `${label}: "to" must be more than ${from}.`);
    }

    for (const c of COMPONENTS) {
      const cell = row.cells[c];
      const name = COMPONENT_LABEL[c];
      if (!cell || !cell.mode) { add(row, `${label}: choose how ${name.toLowerCase()} is charged.`); continue; }
      if (cell.mode === 'none') continue;
      const v = num(cell.value);
      if (v === null || v < 0) add(row, `${label}: ${name.toLowerCase()} needs an amount of 0 or more.`);
      if (cell.mode === 'percent') {
        const ref = num(cell.ref);
        if (cell.ref !== '' && (ref === null || ref <= 0)) {
          add(row, `${label}: "% of" amount must be more than 0, or left empty for the vehicle's base fare.`);
        }
      }
      if (cell.mode === 'per_km' && cell.offset !== '' && cell.offset != null && num(cell.offset) === null) {
        add(row, `${label}: the fixed ₹ added to ${name.toLowerCase()} must be a number (it can be negative).`);
      }
    }
  });

  // Minimum fare: all slabs or none. A floor on some slabs only would leave the rest
  // uncovered and the backend would refuse the whole set.
  const floorCells = ladder.map(r => r.cells?.floor || noFloor());
  const withFloor = floorCells.filter(c => c.mode === 'fixed').length;
  if (withFloor > 0 && withFloor < ladder.length) {
    errors.push('Minimum fare: set it on every slab, or choose "No minimum" on all of them.');
    ladder.forEach(r => { if ((r.cells?.floor?.mode || 'none') !== 'fixed') add(r, 'Minimum fare is missing on this slab.'); });
  }
  floorCells.forEach((c, i) => {
    if (c.mode === 'fixed') {
      const v = num(c.value);
      if (v === null || v < 0) add(ladder[i], `Slab ${i + 1}: minimum fare needs an amount of 0 or more.`);
    }
  });

  Object.values(rowErrors).forEach(list => errors.push(...list));
  return { ok: errors.length === 0, errors, rowErrors };
};

// ─── Ladder editing ─────────────────────────────────────────────────────────

const cloneCells = (cells) => ({
  base: { ...cells.base }, distance: { ...cells.distance }, conv: { ...cells.conv },
  floor: { ...(cells.floor || noFloor()) },
});

/** Add a slab at the end. If the last slab was open-ended it is closed 5 km further out. */
export const addSlab = (ladder) => {
  const last = ladder[ladder.length - 1];
  const rows = ladder.map(r => ({ ...r, cells: cloneCells(r.cells) }));
  if (!last) return blankLadder();
  if (last.to === '' || last.to === null) {
    const lastFrom = num(last.from) ?? 0;
    rows[rows.length - 1].to = plain(lastFrom + 5);
  }
  rows.push({ id: rowId(), from: 0, to: '', cells: cloneCells(last.cells) });
  return normalizeLadder(rows);
};

export const removeSlab = (ladder, id) => {
  if (ladder.length <= 1) return ladder;
  const rows = ladder.filter(r => r.id !== id);
  // Removing the open-ended last row leaves the new last row closed — reopen it.
  if (ladder[ladder.length - 1].id === id) rows[rows.length - 1] = { ...rows[rows.length - 1], to: '' };
  return normalizeLadder(rows);
};

export const setSlabEnd = (ladder, id, to) =>
  normalizeLadder(ladder.map(r => (r.id === id ? { ...r, to } : r)));

export const setCell = (ladder, id, component, patch) =>
  ladder.map(r => (r.id === id
    ? { ...r, cells: { ...r.cells, [component]: { ...r.cells[component], ...patch } } }
    : r));

export const ladderSignature = (ladder) => JSON.stringify(
  ladder.map(r => [r.to, ALL_COMPONENTS.map(c => {
    const x = r.cells[c] || noFloor();
    return [x.mode, x.value, x.ref, x.offset || ''];
  })]),
);

/** Does this ladder use anything the simple view hides (a minimum fare, or a ₹ added to a per-km rate)? */
export const usesAdvanced = (ladder) => ladder.some(r =>
  (r.cells.floor?.mode === 'fixed')
  || COMPONENTS.some(c => r.cells[c]?.mode === 'per_km' && r.cells[c].offset !== '' && num(r.cells[c].offset) !== 0));

// ─── Reading a ladder ───────────────────────────────────────────────────────

export const kmLabel = (row) => {
  const from = num(row.from) ?? 0;
  const to = num(row.to);
  return to === null ? `${plain(from)} km and above` : `${plain(from)} – ${plain(to)} km`;
};

/** { main, sub } for a cell — what the fare is, and how it is worked out. */
export const describeCell = (cell, component = null) => {
  if (component === FLOOR) {
    return cell?.mode === 'fixed'
      ? { main: money(cell.value), sub: 'minimum, after surge' }
      : { main: '—', sub: 'no minimum' };
  }
  switch (cell?.mode) {
    case 'none':    return { main: '—', sub: 'not charged' };
    case 'fixed':   return { main: money(cell.value), sub: 'flat amount' };
    case 'per_km': {
      const off = num(cell.offset);
      const extra = off ? ` ${off > 0 ? '+' : '−'} ${money(Math.abs(off))}` : '';
      return { main: `${money(cell.value)} / km${extra}`, sub: off ? 'rate × trip km, then adjusted' : 'rate × trip km' };
    }
    case 'percent': {
      const ref = num(cell.ref);
      return {
        main: `${plain(cell.value)}%`,
        sub: ref === null ? 'of the vehicle\u2019s base fare' : `of ${money(ref)}`,
      };
    }
    default:        return { main: '—', sub: 'not set' };
  }
};

/** Distances worth looking at: every boundary, just past it, and a few round numbers. */
export const previewKms = (ladder) => {
  const set = new Set([1, 2, 7, 12, 20, 30]);
  for (const r of ladder) {
    const to = num(r.to);
    if (to !== null && to > 0) { set.add(to); set.add(Number((to + 0.1).toFixed(2))); }
  }
  return [...set].filter(k => k > 0).sort((a, b) => a - b).slice(0, 40);
};

/** What a rider pays, GST included, before surge / coupons / subscriber discounts. */
export const riderTotal = (row, gst = {}) => {
  const rideGst = num(gst.riderRatePct) ?? 5;
  const convGst = num(gst.convFeeGstPct) ?? 18;
  const ride = Number(row.rideFare) || 0;
  const conv = Number(row.conv) || 0;
  return Number((ride * (1 + rideGst / 100) + conv * (1 + convGst / 100)).toFixed(2));
};

/**
 * Things worth a second look in a preview:
 *   • a place where the rider's total goes DOWN as the ride gets longer
 *   • distances the set does not cover (they fall back to the old engine)
 */
export const previewWarnings = (preview, gst = {}) => {
  const out = [];
  let prev = null;
  let firstGap = null;
  for (const row of preview || []) {
    if (!row.ok) { if (firstGap === null) firstGap = row.km; continue; }
    const total = riderTotal(row, gst);
    if (prev && total < prev.total - 0.5) {
      out.push({
        kind: 'drop',
        text: `Fare drops ₹${(prev.total - total).toFixed(2)} between ${prev.km} km (₹${prev.total}) and ${row.km} km (₹${total}).`,
      });
    }
    prev = { km: row.km, total };
  }
  if (firstGap !== null) {
    out.push({ kind: 'gap', text: `From ${firstGap} km the set does not cover the trip (the last slab is closed), so the old pricing engine is used there.` });
  }
  return out;
};

// ─── What a cell works out to ───────────────────────────────────────────────

/** Sample km for a row: its upper limit, or 5 km into an open-ended slab. */
export const sampleKm = (row) => {
  const to = num(row.to);
  if (to !== null) return to;
  return (num(row.from) ?? 0) + 5;
};

/** ₹ a cell charges at `km`. null when it cannot be known yet (e.g. % of base fare, base fare unknown). */
export const cellAmount = (cell, km, vehicleBase = null) => {
  switch (cell?.mode) {
    case 'none':    return 0;
    case 'fixed':   return num(cell.value);
    case 'per_km':  {
      const v = num(cell.value);
      return v === null ? null : Number(Math.max(0, v * km + (num(cell.offset) ?? 0)).toFixed(2));
    }
    case 'percent': {
      const v = num(cell.value);
      const ref = num(cell.ref) ?? num(vehicleBase);
      return v === null || ref === null ? null : Number(((v / 100) * ref).toFixed(2));
    }
    default:        return null;
  }
};

/** What a rider pays (with GST) for a trip of sampleKm(row) in this slab, or null if any cell is unfinished. */
export const rowRiderTotal = (row, gst = {}, vehicleBase = null) => {
  const km = sampleKm(row);
  const [b, d, c] = COMPONENTS.map(k => cellAmount(row.cells[k], km, vehicleBase));
  if (b === null || d === null || c === null) return null;
  const floor = row.cells.floor?.mode === 'fixed' ? (num(row.cells.floor.value) ?? 0) : 0;
  return { km, total: riderTotal({ rideFare: Math.max(b + d, floor), conv: c }, gst) };
};

// ─── Ready-made starting points ─────────────────────────────────────────────
// A blank table is the hardest screen to start from. These are real sets the
// founder has already signed off, so "start from an example" is one click.

const sheetRule = (component, min_km, max_km, mode, value, ref_amount = null) => ({
  component, min_km, max_km, mode, value,
  ref_kind: ref_amount === null ? 'vehicle_base_fare' : 'amount', ref_amount,
});

export const TEMPLATES = [
  {
    id: 'go_car_offpeak_sheet',
    label: 'Go Car off-peak sheet (12 Oct)',
    hint: '₹95 flat up to 3.5 km, then ₹15/km with % of ₹80 base and fee, up to 15 km',
    build: () => rulesToLadder([
      sheetRule('base', 0, 3.5, 'fixed', 0),         sheetRule('base', 3.5, 5, 'percent', 40, 80),
      sheetRule('base', 5, 10, 'percent', 35, 80),   sheetRule('base', 10, 15, 'percent', 30, 80),
      sheetRule('distance', 0, 3.5, 'fixed', 95),    sheetRule('distance', 3.5, 15, 'per_km', 15),
      sheetRule('conv', 0, 3.5, 'fixed', 7),         sheetRule('conv', 3.5, 5, 'percent', 22, 80),
      sheetRule('conv', 5, 10, 'percent', 30, 80),   sheetRule('conv', 10, 15, 'percent', 35, 80),
    ]),
  },
];

// ─── Who wins where ─────────────────────────────────────────────────────────

const targetKey = (t, vehicle, band) => `${t.scope}:${t.scope_id ?? '*'}:${vehicle}:${band}`;

/** Targets (from the editor) that already have a set for this vehicle and band. */
export const existingTargets = (targets, existingSets, vehicle, band) => {
  const have = new Map((existingSets || []).map(s => [s.key, s]));
  return targets
    .map(t => ({ target: t, set: have.get(targetKey(t, vehicle, band)) }))
    .filter(x => x.set);
};

/**
 * Plain-language notes about how a new set interacts with the others:
 *   • a city set beats state and all-cities sets
 *   • a state / all-cities set does not touch a city that has its own set
 */
export const precedenceNotes = ({ targets, existingSets, vehicle, band, cities = [] }) => {
  if (!vehicle || targets.length === 0) return [];
  const sets = (existingSets || []).filter(s => s.vehicle_type === vehicle && s.band === band);
  const notes = [];
  const cityById = new Map(cities.map(c => [c.id, c]));

  const cityTargets = targets.filter(t => t.scope === 'city');
  if (cityTargets.length) {
    const global = sets.find(s => s.scope === 'global');
    const stateSets = sets.filter(s => s.scope === 'state');
    const overrides = new Set();
    for (const t of cityTargets) {
      const st = cityById.get(t.scope_id)?.state_id;
      if (global) overrides.add('all-cities');
      if (stateSets.some(s => s.scope_id === st)) overrides.add('state');
    }
    if (overrides.size) {
      notes.push(`${cityTargets.map(t => t.name).join(', ')} will use these slabs instead of the ${[...overrides].join(' / ')} slabs. Other cities are not affected.`);
    }
  } else {
    const own = sets.filter(s => s.scope === 'city'
      && targets.some(t => t.scope === 'global' || (t.scope === 'state' && cityById.get(s.scope_id)?.state_id === t.scope_id)));
    if (own.length) {
      notes.push(`These cities have their own slabs and will keep using them: ${own.map(s => s.scope_name || `City ${s.scope_id}`).join(', ')}.`);
    }
  }
  return notes;
};
