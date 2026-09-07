/**
 * Renders the dispatch pages for real, on the server.
 *
 *   npm run smoke:dispatch
 *
 * Why this exists: `vite build` bundles happily through mistakes that only blow
 * up when a component actually runs. It shipped a `const backTo = searching ?
 * …` that referenced a variable declared further down the function — a
 * temporal-dead-zone crash on every render of the loading state, and the build
 * was green. Nothing here would have been caught by the bundler.
 *
 * What it covers:
 *   - each page's initial (loading) render — imports, hooks, TDZ, bad props
 *   - OfferTimeline and CallList against a REAL captured API payload, so the
 *     data-heavy path renders with the actual wire types (NUMERIC as strings,
 *     nulls for late_online) rather than something hand-made
 *
 * What it does not cover: the pages' post-fetch render, which needs effects to
 * run. renderToString does not run them, and this repo has no DOM test setup.
 * The row-level components below are where that data actually gets formatted.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// The pages call the API on mount. Stub it so nothing touches the network —
// the promise never settles, which is exactly the loading state we want.
const apiStub = `
  export const getPendingDispatch = () => new Promise(() => {});
  export const getRideDispatch    = () => new Promise(() => {});
  export const getDispatchHistory = () => new Promise(() => {});
`;

const entry = `
  import React from 'react';
  import { renderToString } from 'react-dom/server';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import DispatchPage      from '${root}/src/pages/dispatch/DispatchPage.jsx';
  import RideDispatchPage  from '${root}/src/pages/dispatch/RideDispatchPage.jsx';
  import HistoryPage       from '${root}/src/pages/dispatch/HistoryPage.jsx';
  import OfferTimeline, { CallList } from '${root}/src/pages/dispatch/OfferTimeline.jsx';
  import { __HistoryRow, __OffersCell } from '${root}/src/pages/dispatch/HistoryPage.jsx';
  import payload from '${root}/src/pages/dispatch/__fixtures__/realPayload.json';

  const at = (route, path, El) => renderToString(
    React.createElement(MemoryRouter, { initialEntries: [route] },
      React.createElement(Routes, null,
        React.createElement(Route, { path, element: React.createElement(El) }))));

  globalThis.__cases = [
    ['DispatchPage (loading)',     () => at('/dispatch', '/dispatch', DispatchPage)],
    ['HistoryPage (loading)',      () => at('/dispatch/history', '/dispatch/history', HistoryPage)],
    ['RideDispatchPage (loading)', () => at('/dispatch/845', '/dispatch/:rideId', RideDispatchPage)],
    ['OfferTimeline (real payload)', () => renderToString(
      React.createElement(OfferTimeline, { offers: payload.detail.offers }))],
    ['OfferTimeline (empty)',      () => renderToString(
      React.createElement(OfferTimeline, { offers: [] }))],
    ['CallList (real payload)',    () => renderToString(
      React.createElement(CallList, {
        offers: payload.detail.offers.filter(o => o.outcome === 'pending') }))],
    // Deliberately hostile props — a driver row with nothing filled in must
    // still render. Support sees half-populated records in practice.
    ['OfferTimeline (null fields)', () => renderToString(
      React.createElement(OfferTimeline, { offers: [{
        driver: { id: 1, name: null, phone: null, vehicle_type: null,
                  vehicle_number: null, vehicle_model: null },
        source: 'late_online', tier: null, radius_km: null, distance_km: null,
        notified_at: null, outcome: 'pending', outcome_at: null,
      }] }))],
    // CallList khaali offers pe jaan-boojh kar null lautata hai — koi card
    // dikhana hi nahi hai. Isko empty expect karte hain.
    ['CallList (no offers) → empty', () => renderToString(
      React.createElement(CallList, { offers: [] })), 'empty'],
    // History rows carry the tracked/untracked distinction — the part most
    // likely to mislead if it renders wrong. Real rows, both kinds.
    ['HistoryRow (real rows)', () => renderToString(
      React.createElement(MemoryRouter, null,
        React.createElement('table', null, React.createElement('tbody', null,
          ...payload.history.rides.map((r, i) =>
            React.createElement(__HistoryRow, { key: i, row: r, onOpen: () => {} }))))))],
    ['OffersCell untracked → "Not recorded"', () => {
      const html = renderToString(React.createElement(__OffersCell, {
        row: { offers_recorded: 0, offers_tracked: false } }));
      if (!/Not recorded/.test(html)) throw new Error('missing the Not recorded label');
      return html;
    }],
    ['OffersCell tracked + zero → "Reached nobody"', () => {
      const html = renderToString(React.createElement(__OffersCell, {
        row: { offers_recorded: 0, offers_tracked: true } }));
      if (!/Reached nobody/.test(html)) throw new Error('missing the Reached nobody label');
      return html;
    }],
    ['OffersCell tracked + count → the number', () => {
      const html = renderToString(React.createElement(__OffersCell, {
        row: { offers_recorded: 3, offers_tracked: true } }));
      if (!/>3</.test(html)) throw new Error('the count is not rendered');
      if (/Not recorded|Reached nobody/.test(html)) throw new Error('wrong branch taken');
      return html;
    }],
  ];
`;

const out = path.join(os.tmpdir(), `dispatch-smoke-${process.pid}.cjs`);

await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  bundle: true,
  outfile: out,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
  plugins: [{
    name: 'stub-api',
    setup(build) {
      build.onResolve({ filter: /api\/opsApi\.js$/ }, () => ({
        path: 'opsApi-stub', namespace: 'stub',
      }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: apiStub, loader: 'js',
      }));
    },
  }],
});

// react-router SSR pe useLayoutEffect ka warning deta hai — har case pe. Wo
// hamari galti nahi hai aur output doob jaata hai.
const origWarn = console.error;
console.error = (...a) =>
  (String(a[0] || '').includes('useLayoutEffect does nothing on the server')
    ? undefined : origWarn(...a));

let pass = 0, fail = 0;
try {
  const { createRequire } = await import('module');
  createRequire(import.meta.url)(out);

  for (const [name, run, expect] of globalThis.__cases) {
    try {
      const html = run();
      if (expect === 'empty') {
        if (html) throw new Error(`expected nothing, got ${html.length} chars`);
      } else if (!html || html.length < 20) {
        throw new Error(`rendered almost nothing (${html.length} chars)`);
      }
      console.log(`  ✓ ${name}  (${html.length} chars)`);
      pass++;
    } catch (e) {
      console.log(`  ✗ ${name}\n      ${e.message}`);
      fail++;
    }
  }
} finally {
  console.error = origWarn;
  fs.rmSync(out, { force: true });
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} rendered, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
