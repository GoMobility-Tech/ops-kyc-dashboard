/**
 * Runs dispatchMeta.js against a REAL backend payload.
 *
 *   npm run verify:dispatch
 *
 * The fixture in src/pages/dispatch/__fixtures__/realPayload.json was captured
 * from the live API (inside a transaction that was rolled back, so no prod rows
 * were created). It is not hand-written — every value, including the NUMERIC
 * columns that arrive as strings, is exactly what the backend sends.
 *
 * This covers the seam where a dashboard and its API most often drift apart:
 *   - NUMERIC columns arriving as strings ("147.10", not 147.1)
 *   - nulls that are meaningful (late_online has no tier or radius)
 *   - waiting_minutes meaning something different on an already-matched ride
 *
 * No test framework — the repo has none, and this needs nothing more.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as M from '../src/pages/dispatch/dispatchMeta.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { detail, pending, history } = JSON.parse(fs.readFileSync(
  path.join(here, '../src/pages/dispatch/__fixtures__/realPayload.json'), 'utf8'));

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

console.log('\n── NUMERIC columns arrive as strings ──');
t('estimated_fare arrives as a string and formats to 2dp', () => {
  // Derived from the fixture, not hardcoded — the fixture gets recaptured and a
  // pinned number would fail for the wrong reason (it did).
  const raw = detail.ride.estimated_fare;
  eq(typeof raw, 'string', 'backend really does send a string:');
  eq(M.fmtRupees(raw), `₹${Number(raw).toFixed(2)}`);
  if (!/^₹\d+\.\d{2}$/.test(M.fmtRupees(raw)))
    throw new Error(`bad shape: ${M.fmtRupees(raw)}`);
});
t('distance_km arrives as a string and formats to 1dp', () => {
  const raw = detail.offers[0].distance_km;
  eq(typeof raw, 'string');
  eq(M.fmtKm(raw), `${Number(raw).toFixed(1)} km`);
});
t('radius_km formats to 1dp', () => {
  const raw = detail.offers[0].radius_km;
  eq(M.fmtKm(raw), `${Number(raw).toFixed(1)} km`);
});
t('current_search_radius_km is a string on the list too', () =>
  eq(typeof pending.rides[0].current_search_radius_km, 'string'));
t('lat/lng are strings and survive num()', () => {
  eq(typeof detail.ride.pickup_location.latitude, 'string');
  if (M.num(detail.ride.pickup_location.latitude) === null) throw new Error('num() returned null');
});

console.log('\n── nulls that mean something ──');
t('late_online has no tier/radius → "—", never "0 km"', () => {
  const late = detail.offers.find(o => o.source === 'late_online');
  if (late) { eq(late.tier, null); eq(M.fmtKm(late.radius_km), '—'); }
  else eq(M.fmtKm(null), '—');
});
t('outcome_at is null while pending → "—"', () => {
  const p = detail.offers.find(o => o.outcome === 'pending');
  eq(p.outcome_at, null); eq(M.fmtTime(p.outcome_at), '—');
});
t('num() rejects non-numeric input', () => {
  eq(M.num('abc'), null); eq(M.num(''), null); eq(M.num(null), null);
  eq(M.num([]), null, 'the Number([]) === 0 trap:');
  eq(M.num(true), null, 'the Number(true) === 1 trap:');
});

console.log('\n── waiting_minutes ──');
t('the API returns waiting_minutes as a real number', () => {
  // A string here would silently break the tone thresholds.
  if (typeof pending.rides[0].waiting_minutes !== 'number')
    throw new Error(`got ${typeof pending.rides[0].waiting_minutes}`);
  eq(M.fmtWait(7), '7m');
});
t('a negative value renders as "0m", never "-501m"', () => {
  // Pure unit check on purpose. This started as a fixture assertion and broke
  // when the fixture was recaptured with a positive value — but the guard it
  // protects is still real: the detail query computes
  // COALESCE(driver_assigned_at, NOW()) - requested_at, which can go negative.
  eq(M.fmtWait(-501), '0m');
  eq(M.fmtWait(-1), '0m');
  eq(M.fmtWait(0), '0m');
});
t('over an hour → "1h 5m"', () => eq(M.fmtWait(65), '1h 5m'));
t('a matched ride is never painted red', () => {
  eq(M.waitTone(600, 'completed'), 'neutral');
  eq(M.waitLabel('completed'), 'Time to match');
  eq(M.waitLabel('requested'), 'Waiting');
});
t('thresholds: 2 neutral, 3 warning, 5 danger', () => {
  eq(M.waitTone(2, 'requested'), 'neutral');
  eq(M.waitTone(3, 'requested'), 'warning');
  eq(M.waitTone(5, 'requested'), 'danger');
});

console.log('\n── enums (every value present in the real payload) ──');
t('every source has a label, not the raw key', () => {
  for (const o of detail.offers) {
    const m = M.sourceMeta(o.source);
    if (!m.label || m.label === o.source) throw new Error(`source "${o.source}" has no label`);
  }
});
t('every outcome has a label and a tone', () => {
  for (const o of detail.offers) {
    const m = M.outcomeMeta(o.outcome);
    if (!m.label || !m.tone) throw new Error(`outcome "${o.outcome}" is incomplete`);
  }
});
t('an unknown value degrades instead of crashing', () => {
  if (!M.sourceMeta('something_new').label) throw new Error('empty label');
  if (!M.outcomeMeta(undefined).tone) throw new Error('empty tone');
});

console.log('\n── phone / call ──');
t('10 digits → tel:+91…', () =>
  eq(M.telHref(detail.offers[0].driver.phone), `tel:+91${detail.offers[0].driver.phone}`));
t('missing phone → null, so no dead link renders', () => {
  eq(M.telHref(null), null); eq(M.telHref(''), null); eq(M.telHref('—'), null);
});

console.log('\n── summary ──');
t('all five counters present and they add up', () => {
  const s = detail.summary;
  for (const k of ['total', 'pending', 'accepted', 'rejected', 'expired'])
    if (typeof s[k] !== 'number') throw new Error(`${k} is not a number`);
  eq(s.pending + s.accepted + s.rejected + s.expired, s.total);
});
t('pendingOffers() returns exactly the drivers to call', () => {
  const p = M.pendingOffers(detail.offers);
  eq(p.length, detail.summary.pending);
  if (p.some(o => o.outcome !== 'pending')) throw new Error('a settled offer leaked in');
});

console.log('\n── history: search filters ──');
t('every status in STATUS_FILTERS has a tone', () => {
  for (const f of M.STATUS_FILTERS) {
    if (!f.value) continue;                       // "Any status"
    if (!M.statusTone(f.value)) throw new Error(`${f.value} has no tone`);
  }
});
t('every status the API actually returned has a tone', () => {
  for (const r of history.rides) {
    if (M.statusTone(r.status) === 'neutral' && r.status !== 'expired')
      throw new Error(`status "${r.status}" falls through to neutral`);
  }
});
t('DAY_FILTERS stay inside the backend 1..90 clamp', () => {
  for (const f of M.DAY_FILTERS) {
    const n = Number(f.value);
    if (!(n >= 1 && n <= 90)) throw new Error(`${f.value} is outside 1..90`);
  }
});
t('an unknown status degrades to neutral instead of crashing', () =>
  eq(M.statusTone('something_new'), 'neutral'));

console.log('\n── history: offers_tracked ──');
t('the fixture really carries both tracked and untracked rows', () => {
  // Without both, the assertions below would pass on an empty set.
  const tracked   = history.rides.filter(r => r.offers_tracked).length;
  const untracked = history.rides.filter(r => !r.offers_tracked).length;
  if (!tracked || !untracked)
    throw new Error(`fixture is one-sided: ${tracked} tracked, ${untracked} untracked`);
});
t('offers_tracked is a real boolean on every row', () => {
  for (const r of history.rides)
    if (typeof r.offers_tracked !== 'boolean')
      throw new Error(`ride ${r.ride_id}: ${typeof r.offers_tracked}`);
});
t('a row with offers recorded is never marked untracked', () => {
  // This is the contradiction that would put "Not recorded" on a ride whose
  // driver list is right there on screen.
  for (const r of history.rides)
    if (r.offers_recorded > 0 && !r.offers_tracked)
      throw new Error(`ride ${r.ride_id} has ${r.offers_recorded} offers but is untracked`);
});
t('the detail response carries the flag too', () => {
  if (typeof detail.offers_tracked !== 'boolean')
    throw new Error('detail.offers_tracked is not a boolean');
});

console.log('\n── history: waiting_minutes changes meaning ──');
t('a still-searching ride is labelled Waiting', () => {
  const live = history.rides.find(r => r.status === 'requested');
  if (live) {
    eq(M.waitLabel(live.status), 'Waiting');
    eq(M.isSearching(live.status), true);
  }
});
t('a settled ride is labelled Time to match and stays neutral', () => {
  const done = history.rides.find(r => r.status !== 'requested');
  if (!done) throw new Error('fixture has no settled ride');
  eq(M.waitLabel(done.status), 'Time to match');
  eq(M.waitTone(done.waiting_minutes, done.status), 'neutral');
});
t('every history row formats a wait without producing junk', () => {
  for (const r of history.rides) {
    const out = M.fmtWait(r.waiting_minutes);
    if (out.startsWith('-')) throw new Error(`ride ${r.ride_id} rendered "${out}"`);
    if (!out) throw new Error(`ride ${r.ride_id} rendered nothing`);
  }
});

console.log('\n── history: response envelope ──');
t('paging and window fields are present', () => {
  for (const k of ['rides', 'count', 'has_more', 'tracking_since', 'searched', 'days_window'])
    if (!(k in history)) throw new Error(`missing ${k}`);
});
t('an unsearched response reports its day window', () => {
  eq(history.searched, false);
  if (typeof history.days_window !== 'number') throw new Error('days_window is not a number');
});
t('every row has what the table renders', () => {
  for (const r of history.rides)
    for (const k of ['ride_id', 'ride_number', 'status', 'passenger_name', 'passenger_phone',
                     'waiting_minutes', 'offers_recorded', 'offers_tracked', 'requested_at'])
      if (!(k in r)) throw new Error(`ride ${r.ride_id} missing ${k}`);
});
t('history money and counts survive formatting', () => {
  for (const r of history.rides) {
    if (M.fmtRupees(r.estimated_fare) === '—' && r.estimated_fare != null)
      throw new Error(`ride ${r.ride_id}: fare "${r.estimated_fare}" did not format`);
    if (typeof r.offers_recorded !== 'number')
      throw new Error(`ride ${r.ride_id}: offers_recorded is ${typeof r.offers_recorded}`);
  }
});

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
