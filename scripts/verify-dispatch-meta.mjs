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
const { detail, pending } = JSON.parse(fs.readFileSync(
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
t('estimated_fare "147.10" → ₹147.10', () => {
  eq(typeof detail.ride.estimated_fare, 'string', 'backend really does send a string:');
  eq(M.fmtRupees(detail.ride.estimated_fare), '₹147.10');
});
t('distance_km "1.20" → 1.2 km', () => {
  eq(typeof detail.offers[0].distance_km, 'string');
  eq(M.fmtKm(detail.offers[0].distance_km), '1.2 km');
});
t('radius_km "5.00" → 5.0 km', () =>
  eq(M.fmtKm(detail.offers[0].radius_km), '5.0 km'));
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
t('list value 7 renders as "7m"', () => {
  eq(pending.rides[0].waiting_minutes, 7);
  eq(M.fmtWait(7), '7m');
});
t('a negative value renders as "0m", not "-501m"', () => {
  if (detail.ride.waiting_minutes >= 0) throw new Error('fixture was expected to hold a negative');
  eq(M.fmtWait(detail.ride.waiting_minutes), '0m');
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

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
