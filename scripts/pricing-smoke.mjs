/**
 * Renders the Pricing Settings screen for real, on the server.
 *
 *   npm run smoke:pricing
 *
 * Same reasoning as smoke:dispatch — `vite build` bundles happily through
 * mistakes that only appear when a component actually runs.
 *
 * What makes this one worth having beyond a render check: every tab is a FORM
 * over live pricing, and the backend rejects unknown field names with a 400.
 * So the cases below also assert the two things that decide whether a save is
 * correct or a silent disaster:
 *
 *   - buildPatch sends ONLY what changed, in the type the validator wants
 *   - the fields it sends all exist in the backend's schema
 *
 * The payload is captured from production (`__fixtures__/pricingPayload.json`),
 * so the forms render against real wire types — NUMERIC comes back as a string,
 * nullable columns really are null, and three settings have no row at all.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// Nothing may touch the network. A promise that never settles is exactly the
// loading state we want, and the write calls must never be reachable from a
// render.
const apiStub = `
  const never = () => new Promise(() => {});
  export const getPricingVehicles     = never;
  export const getPricingSettings     = never;
  export const getPricingSettingsMeta = never;
  export const getPricingGst          = never;
  export const getPricingTiers        = never;
  export const getPricingSubscribers  = never;
  export const getPricingPenalties    = never;
  export const getPricingAudit        = never;
  export const reloadPricingCache     = never;
  export const updatePricingVehicle   = never;
  export const createPricingVehicle   = never;
  export const updatePricingSetting   = never;
  export const updatePricingGst       = never;
  export const savePricingTier        = never;
  export const updatePricingSubscriber = never;
  export const savePricingPenalty     = never;
  export const deletePricingPenalty   = never;
`;

const entry = `
  import React from 'react';
  import { renderToString } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';

  import PricingSettingsPage from '${root}/src/pages/pricing-settings/PricingSettingsPage.jsx';
  import VehiclesTab    from '${root}/src/pages/pricing-settings/VehiclesTab.jsx';
  import SettingsTab    from '${root}/src/pages/pricing-settings/SettingsTab.jsx';
  import GstTab         from '${root}/src/pages/pricing-settings/GstTab.jsx';
  import TiersTab       from '${root}/src/pages/pricing-settings/TiersTab.jsx';
  import SubscribersTab from '${root}/src/pages/pricing-settings/SubscribersTab.jsx';
  import PenaltiesTab   from '${root}/src/pages/pricing-settings/PenaltiesTab.jsx';
  import AuditTab, { OriginCell, ChangeCell } from '${root}/src/pages/pricing-settings/AuditTab.jsx';
  import {
    buildPatch, splitVehiclePatch, VEHICLE_FIELDS, TIER_FIELDS,
    GST_FIELDS, SUBSCRIBER_FIELDS, PENALTY_FIELDS, isOff, cacheWarning,
    describeFailure,
  } from '${root}/src/pages/pricing-settings/pricingMeta.js';
  import payload from '${root}/src/pages/pricing-settings/__fixtures__/pricingPayload.json';

  const noop = () => {};
  const render = (El, props) => renderToString(
    React.createElement(MemoryRouter, null, React.createElement(El, props)));

  // React splits adjacent text nodes with <!-- --> on the server, so "Base ₹20"
  // arrives as "Base <!-- -->₹20". Strip the markers before matching text.
  const text = (html) => html.replace(/<!--.*?-->/g, '');

  // What a person actually reads: tags stripped, so attribute values like a
  // title tooltip do not count as visible content.
  const visible = (html) => text(html).replace(/<[^>]*>/g, ' ');

  const must = (cond, msg) => { if (!cond) throw new Error(msg); };

  globalThis.__cases = [
    // ── Renders ────────────────────────────────────────────────────────────
    ['PricingSettingsPage (loading)', () => render(PricingSettingsPage)],

    ['VehiclesTab (real payload)', () => {
      const html = render(VehiclesTab, { data: payload.vehicles, onSaved: noop, onError: noop });
      must(/Base ₹/.test(text(html)), 'the fare summary line is missing');
      return html;
    }],

    ['SettingsTab (real payload)', () => {
      const html = render(SettingsTab, {
        settings: payload.settings, metaGroups: payload.meta.groups,
        onSaved: noop, onError: noop,
      });
      // 35 of the 66 rows have no catalog entry. They must be on screen and
      // read-only — hiding live pricing on the pricing screen is the failure
      // this whole module exists to remove.
      must(/Engineer-only key/.test(text(html)), 'engineer-only keys are not shown read-only');
      // Three settings have no row in the table; the engine uses a fallback.
      must(/Built-in default/.test(text(html)), 'the synthesized defaults are not flagged');
      return html;
    }],

    ['GstTab (real payload)',         () => render(GstTab, { gst: payload.gst, onSaved: noop, onError: noop })],
    ['TiersTab (real payload)',       () => render(TiersTab, { tiers: payload.tiers, onSaved: noop, onError: noop })],
    ['SubscribersTab (real payload)', () => render(SubscribersTab, { subscribers: payload.subscribers, onSaved: noop, onError: noop })],
    ['PenaltiesTab (real payload)',   () => render(PenaltiesTab, { penalties: payload.penalties, onSaved: noop, onError: noop, onDeleted: noop })],
    ['AuditTab (loading)',            () => render(AuditTab)],

    // ── Change history rows ────────────────────────────────────────────────
    // pricing_config_audit is empty in production — nothing has ever been
    // changed through the dashboard, because the screen did not exist. So
    // these rows are written by hand, in the shape the table produces.
    ['OriginCell: ip + device → both shown', () => {
      const html = renderToString(React.createElement('table', null,
        React.createElement('tbody', null, React.createElement('tr', null,
          React.createElement('td', null, React.createElement(OriginCell, { row: {
            ip_address: '49.36.12.7',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          } }))))));
      const t = text(html);
      must(/49\.36\.12\.7/.test(t), 'the IP is missing');
      must(/Chrome/.test(t) && /Mac/.test(t), 'the device was not shortened: ' + t);
      // The full string stays in the title attribute on purpose — hovering
      // gives the exact device. What must not happen is 200 characters of it
      // sitting in the table cell.
      must(!/AppleWebKit/.test(visible(html)), 'the raw user agent is being displayed, not just on hover');
      must(/AppleWebKit/.test(html), 'the full user agent is not available on hover either');
      return html;
    }],

    ['OriginCell: pre-migration row says "not recorded"', () => {
      // Rows written before Migration 128 have no origin. A blank cell would
      // read as "nobody", which is a different claim from "never captured".
      const html = renderToString(React.createElement('table', null,
        React.createElement('tbody', null, React.createElement('tr', null,
          React.createElement('td', null,
            React.createElement(OriginCell, { row: { ip_address: null, user_agent: null } }))))));
      must(/not recorded/.test(text(html)), 'a missing origin rendered blank');
      return html;
    }],

    ['OriginCell: ip alone is enough', () => {
      const html = renderToString(React.createElement('table', null,
        React.createElement('tbody', null, React.createElement('tr', null,
          React.createElement('td', null,
            React.createElement(OriginCell, { row: { ip_address: '10.0.26.242', user_agent: null } }))))));
      const t = text(html);
      must(/10\.0\.26\.242/.test(t), 'the IP is missing');
      must(!/not recorded/.test(t), 'an IP-only row was called unrecorded');
      return html;
    }],

    ['ChangeCell: a created row shows an em dash, not "null"', () => {
      const html = renderToString(React.createElement(ChangeCell, {
        row: { old_value: null, new_value: '1.75' } }));
      const t = text(html);
      must(/1\.75/.test(t), 'the new value is missing');
      must(!/null/.test(t), '"null" leaked onto the screen');
      return html;
    }],

    // ── Hostile props ──────────────────────────────────────────────────────
    // A half-populated row must still render. Several vehicle columns really
    // are null in production (surge_cap, per_km_rate_10_20, max_pickup_radius_km).
    ['VehiclesTab (all nulls)', () => render(VehiclesTab, {
      data: { vehicles: [{ vehicle_type: 'car', display_name: null, base_fare: null,
                           per_km_rate: null, minimum_fare: null, is_active: true }],
              availableToAdd: [] },
      onSaved: noop, onError: noop })],
    ['Tabs (empty lists)', () => [
      render(TiersTab,       { tiers: [],       onSaved: noop, onError: noop }),
      render(SubscribersTab, { subscribers: [], onSaved: noop, onError: noop }),
      render(PenaltiesTab,   { penalties: [],   onSaved: noop, onError: noop, onDeleted: noop }),
      render(SettingsTab,    { settings: [], metaGroups: [], onSaved: noop, onError: noop }),
    ].join('')],

    // ── The patch, which is what actually reaches live pricing ─────────────
    ['patch: an untouched form sends nothing', () => {
      const row = payload.vehicles.vehicles[0];
      const seed = {};
      for (const f of VEHICLE_FIELDS) {
        seed[f.key] = f.type === 'boolean' ? Boolean(row[f.key]) : (row[f.key] ?? '');
      }
      const patch = buildPatch(seed, seed, VEHICLE_FIELDS);
      must(Object.keys(patch).length === 0,
        'an untouched form would POST ' + JSON.stringify(patch));
      return 'ok';
    }],

    ['patch: only the changed field, as a number', () => {
      const seed = { base_fare: '50.00', per_km_rate: '12.00', is_active: true };
      const draft = { ...seed, base_fare: '55.5' };
      const patch = buildPatch(draft, seed, VEHICLE_FIELDS);
      must(Object.keys(patch).length === 1, 'sent more than the changed field: ' + JSON.stringify(patch));
      must(patch.base_fare === 55.5, 'base_fare is not a number: ' + JSON.stringify(patch));
      return 'ok';
    }],

    ['patch: "50.00" → "50" is not a change', () => {
      // NUMERIC arrives as "50.00". Retyping the same number must not fire a
      // pricing write, or every visit to the screen writes an audit row.
      const seed  = { base_fare: '50.00' };
      const patch = buildPatch({ base_fare: '50' }, seed, VEHICLE_FIELDS);
      must(Object.keys(patch).length === 0, 'a no-op edit produced ' + JSON.stringify(patch));
      return 'ok';
    }],

    ['patch: emptying a non-nullable field is ignored, not zero', () => {
      // Sending 0 for a cleared base fare would make the category run free
      // rides. An empty box means "unchanged".
      const patch = buildPatch({ base_fare: '' }, { base_fare: '50.00' }, VEHICLE_FIELDS);
      must(patch.base_fare === undefined, 'a cleared base fare became ' + patch.base_fare);
      return 'ok';
    }],

    ['patch: emptying a nullable field sends null', () => {
      // Null is meaningful: a null surge_cap means "use the global cap".
      const patch = buildPatch({ surge_cap: '' }, { surge_cap: '1.50' }, VEHICLE_FIELDS);
      must(patch.surge_cap === null, 'a cleared surge cap became ' + JSON.stringify(patch));
      return 'ok';
    }],

    ['patch: false and 0 are real values, not "untouched"', () => {
      const p1 = buildPatch({ is_active: false }, { is_active: true }, VEHICLE_FIELDS);
      must(p1.is_active === false, 'switching a vehicle off was dropped');
      const p2 = buildPatch({ platform_fee: '0' }, { platform_fee: '5.00' }, VEHICLE_FIELDS);
      must(p2.platform_fee === 0, 'a zero platform fee was dropped');
      return 'ok';
    }],

    ['patch: convenience fee is split into its own object', () => {
      const flat = buildPatch(
        { base_fare: '60', off_peak_base: '9' },
        { base_fare: '50.00', off_peak_base: '8.00' },
        VEHICLE_FIELDS);
      const body = splitVehiclePatch(flat);
      must(body.base_fare === 60, 'base_fare did not survive the split');
      must(body.convenience && body.convenience.off_peak_base === 9,
        'convenience was not nested: ' + JSON.stringify(body));
      must(body.off_peak_base === undefined,
        'convenience was left flat as well — the backend 400s on that');
      return 'ok';
    }],

    // ── Field names must exist in the backend schema ───────────────────────
    // Unknown keys are rejected with a 400. A typo here is a save that fails
    // for a field nobody touched, which blocks every other edit on the form.
    ['field names match the backend validator', () => {
      const expected = {
        vehicle: ['display_name','base_fare','per_km_rate','minimum_fare','per_km_rate_10_20',
          'per_km_rate_20_plus','platform_fee','platform_fee_daily_cap','avg_speed_kmph',
          'pickup_free_km','pickup_rate_per_km','waiting_grace_minutes','waiting_rate_per_min',
          'traffic_grace_minutes','traffic_rate_per_min','night_multiplier','max_pickup_radius_km',
          'wait_charge_cap','auto_cancel_minutes','surge_cap','vehicle_class','max_vehicle_age_years',
          'min_engine_cc','ac_required','category_notes','is_active','sort_order',
          'off_peak_base','peak_base'],
        tier: ['min_km','max_km','multiplier','is_active','sort_order','description'],
        subscriber: ['free_km','discount_pct_beyond','surge_cap','monthly_price','free_rides_per_day',
          'free_rides_per_month','surge_protection_rides','display_label','is_active'],
        gst: ['gst_enabled','rider_rate_pct','platform_rate_pct','conv_fee_gst_pct','subscription_gst_pct',
          'wallet_topup_gst_pct','auto_gst_exempt','rider_sac_code','platform_sac_code','conv_sac_code',
          'gst_registration_no'],
        penalty: ['penalty_amount','suspension_days','requires_rekyc','is_permanent_ban',
          'rider_refund_amount','escalation_window_days','action_notes','is_active'],
      };
      const check = (label, fields, allowed) => {
        const bad = fields.map(f => f.key).filter(k => !allowed.includes(k));
        must(bad.length === 0, label + ' sends fields the backend rejects: ' + bad.join(', '));
      };
      check('VEHICLE_FIELDS',    VEHICLE_FIELDS,    expected.vehicle);
      check('TIER_FIELDS',       TIER_FIELDS,       expected.tier);
      check('SUBSCRIBER_FIELDS', SUBSCRIBER_FIELDS, expected.subscriber);
      check('GST_FIELDS',        GST_FIELDS,        expected.gst);
      check('PENALTY_FIELDS',    PENALTY_FIELDS,    expected.penalty);
      return 'ok';
    }],

    // ── Small helpers with a real consequence ──────────────────────────────
    ['999999 reads as "off", a normal cap does not', () => {
      must(isOff('999999.00') === true,  'the sentinel is not recognised');
      must(isOff('50.00')     === false, 'a real cap was labelled off');
      must(isOff(null)        === false, 'null was labelled off');
      return 'ok';
    }],

    ['a section that 403s explains itself instead of rendering blank', () => {
      // The bug this guards: the GST tab rendered an empty form with the
      // switch off while production had GST on at 5 percent, because a 403
      // was folded into an empty object. Blank pricing fields read as
      // settings, not as an error.
      const loaded = describeFailure({ status: 'fulfilled', value: {} });
      must(loaded === null, 'a loaded section was reported as failed');

      const denied = describeFailure({
        status: 'rejected', reason: { response: { status: 403 } } });
      must(typeof denied === 'string' && /admin role/.test(denied),
        'a 403 did not explain the role requirement: ' + denied);

      const broke = describeFailure({
        status: 'rejected', reason: { response: { status: 500, data: { message: 'boom' } } } });
      must(broke === 'boom', 'the server message was lost: ' + broke);

      const offline = describeFailure({ status: 'rejected', reason: { message: 'Network Error' } });
      must(offline === 'Network Error', 'a network failure said nothing: ' + offline);
      return 'ok';
    }],

    ['cache warning fires only when a broadcast failed', () => {
      must(cacheWarning({ data: { data: { cache: { all_servers: true } } } }) === null,
        'warned on a clean save');
      must(cacheWarning({ data: { data: {} } }) === null, 'warned with no cache block');
      const warn = cacheWarning({ data: { data: { cache: { all_servers: false, note: 'Redis down' } } } });
      must(warn === 'Redis down', 'the failed broadcast was not surfaced');
      return 'ok';
    }],
  ];
`;

const out = path.join(os.tmpdir(), `pricing-smoke-${process.pid}.cjs`);

await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  bundle: true,
  outfile: out,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.json': 'json' },
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

const origWarn = console.error;
console.error = (...a) =>
  (String(a[0] || '').includes('useLayoutEffect does nothing on the server')
    ? undefined : origWarn(...a));

let pass = 0, fail = 0;
try {
  const { createRequire } = await import('module');
  createRequire(import.meta.url)(out);

  for (const [name, run] of globalThis.__cases) {
    try {
      const html = run();
      if (!html || html.length < 2) throw new Error(`rendered almost nothing (${html?.length} chars)`);
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

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
