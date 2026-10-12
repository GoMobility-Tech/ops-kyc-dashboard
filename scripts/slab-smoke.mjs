/**
 * Distance slabs screen — model checks + real server-side renders.
 *
 *   npm run smoke:slabs
 *
 * Two kinds of case:
 *   • slabModel is pure, so it is asserted directly: the founder's sheet must
 *     survive rules → ladder → rules unchanged in meaning, boundaries that do not
 *     line up across components must not lose a rate, and every way a ladder can
 *     be wrong must be caught before it is sent.
 *   • the components are rendered with renderToString against the same data
 *     shapes the API returns (numbers arrive as strings from Postgres).
 *
 * Nothing may touch the network: the api module is stubbed with promises that
 * never settle, and no write call is reachable from a render.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const apiStub = `
  const never = () => new Promise(() => {});
  export const getSlabRules = never;
  export const getSlabCoverage = never;
  export const getSlabScopes = never;
  export const previewSlabRules = never;
  export const saveSlabSet = never;
  export const deleteSlabSet = never;
`;

const entry = `
  import React from 'react';
  import { renderToString } from 'react-dom/server';
  import SlabsTab from '${root}/src/pages/pricing-settings/slab/SlabsTab.jsx';
  import SlabSetCard from '${root}/src/pages/pricing-settings/slab/SlabSetCard.jsx';
  import SlabEditor from '${root}/src/pages/pricing-settings/slab/SlabEditor.jsx';
  import SlabLadderTable from '${root}/src/pages/pricing-settings/slab/SlabLadderTable.jsx';
  import SlabPreviewTable from '${root}/src/pages/pricing-settings/slab/SlabPreviewTable.jsx';
  import ScopePicker from '${root}/src/pages/pricing-settings/slab/ScopePicker.jsx';
  import * as M from '${root}/src/pages/pricing-settings/slab/slabModel.js';

  const render = (El, props) => renderToString(React.createElement(El, props));
  const text = (html) => html.replace(/<!--.*?-->/g, '');
  const visible = (html) => text(html).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };
  const eq = (a, b, msg) => must(JSON.stringify(a) === JSON.stringify(b), msg + '\\n   got      ' + JSON.stringify(a) + '\\n   expected ' + JSON.stringify(b));

  // ── The founder's sheet, as the API returns it (numbers are strings) ──────
  const rule = (component, min, max, mode, value, ref) => ({
    scope: 'city', scope_id: 108, vehicle_type: 'car', band: 'off_peak', component,
    min_km: String(min), max_km: max === null ? null : String(max), mode, value: String(value),
    ref_kind: ref ? 'amount' : 'vehicle_base_fare', ref_amount: ref ? String(ref) : null,
    is_active: true, updated_at: '2026-10-12T10:00:00+05:30', note: 'Founder sheet',
  });
  const SHEET = [
    rule('base', 0, 3.5, 'fixed', 0),       rule('base', 3.5, 5, 'percent', 40, 80),
    rule('base', 5, 10, 'percent', 35, 80), rule('base', 10, 15, 'percent', 30, 80),
    rule('distance', 0, 3.5, 'fixed', 95),  rule('distance', 3.5, 5, 'per_km', 15),
    rule('distance', 5, 10, 'per_km', 15),  rule('distance', 10, 15, 'per_km', 15),
    rule('conv', 0, 3.5, 'fixed', 7),       rule('conv', 3.5, 5, 'percent', 22, 80),
    rule('conv', 5, 10, 'percent', 30, 80), rule('conv', 10, 15, 'percent', 35, 80),
  ];
  const SET = {
    key: 'city:108:car:off_peak', scope: 'city', scope_id: 108, scope_name: 'Chandigarh',
    vehicle_type: 'car', band: 'off_peak', rows: SHEET, valid: true, errors: [], warnings: [],
    updated_at: '2026-10-12T10:00:00+05:30', note: 'Founder sheet',
  };
  const OPTIONS = { scopes: ['global', 'state', 'city'], bands: ['off_peak', 'peak', 'night'],
                    components: ['base', 'distance', 'conv'], modes: ['fixed', 'percent', 'per_km'],
                    vehicle_types: ['bike', 'auto', 'car', 'xl'] };
  const SCOPES = { states: [{ id: 6, name: 'Chandigarh' }, { id: 13, name: 'Haryana' }],
    cities: [{ id: 108, name: 'Chandigarh', state_id: 6, state_name: 'Chandigarh', is_active: true },
             { id: 159, name: 'Panchkula', state_id: 13, state_name: 'Haryana', is_active: true },
             { id: 153, name: 'Gurgaon', state_id: 13, state_name: 'Haryana', is_active: true }] };
  const noop = () => {};

  globalThis.__cases = [
    // ── Model ──────────────────────────────────────────────────────────────
    ['sheet: rules → ladder has the four slabs with the right cells', () => {
      const l = M.rulesToLadder(SHEET);
      eq(l.map(r => [r.from, r.to]), [[0, '3.5'], [3.5, '5'], [5, '10'], [10, '15']], 'boundaries');
      eq(l[0].cells.base.mode, 'none', 'no base fare on the first slab is "None"');
      eq(l[0].cells.distance, { mode: 'fixed', value: '95', ref: '' }, 'static distance');
      eq(l[0].cells.conv, { mode: 'fixed', value: '7', ref: '' }, 'static conv');
      eq(l[1].cells.base, { mode: 'percent', value: '40', ref: '80' }, '40% of 80');
      eq(l[3].cells.conv, { mode: 'percent', value: '35', ref: '80' }, '35% of 80');
      eq(l[2].cells.distance, { mode: 'per_km', value: '15', ref: '' }, 'per km');
      return 'ok';
    }],

    ['sheet: ladder → rules joins equal neighbours (₹15/km on three slabs = one rule)', () => {
      const out = M.ladderToRules(M.rulesToLadder(SHEET));
      const dist = out.filter(r => r.component === 'distance');
      eq(dist.map(r => [r.min_km, r.max_km, r.mode, r.value]), [[0, 3.5, 'fixed', 95], [3.5, 15, 'per_km', 15]], 'distance');
      eq(out.filter(r => r.component === 'base').length, 4, 'base rules');
      eq(out.filter(r => r.component === 'conv').length, 4, 'conv rules');
      const b = out.find(r => r.component === 'base' && r.min_km === 3.5);
      eq([b.mode, b.value, b.ref_kind, b.ref_amount], ['percent', 40, 'amount', 80], 'percent of fixed amount survives');
      const z = out.find(r => r.component === 'base' && r.min_km === 0);
      eq([z.mode, z.value], ['fixed', 0], '"None" is stored as fixed 0');
      return 'ok';
    }],

    ['percent with empty "of" amount = % of the vehicle base fare', () => {
      const r = M.cellToRule({ mode: 'percent', value: '40', ref: '' });
      eq([r.ref_kind, r.ref_amount], ['vehicle_base_fare', null], 'ref');
      return 'ok';
    }],

    ['components with different boundaries: ladder uses the union and keeps every rate', () => {
      const rs = [
        rule('base', 0, 5, 'fixed', 10),      rule('base', 5, null, 'fixed', 20),
        rule('distance', 0, 3.5, 'fixed', 95), rule('distance', 3.5, null, 'per_km', 15),
        rule('conv', 0, null, 'fixed', 7),
      ];
      const l = M.rulesToLadder(rs);
      eq(l.map(r => [r.from, r.to]), [[0, '3.5'], [3.5, '5'], [5, '']], 'union of boundaries');
      eq(l.map(r => r.cells.base.value), ['10', '10', '20'], 'base');
      eq(l.map(r => r.cells.distance.mode), ['fixed', 'per_km', 'per_km'], 'distance');
      eq(l.map(r => r.cells.conv.value), ['7', '7', '7'], 'conv');
      eq(M.validateLadder(l).ok, true, 'valid');
      // and back: conv stays ONE open rule
      const back = M.ladderToRules(l);
      eq(back.filter(r => r.component === 'conv').map(r => [r.min_km, r.max_km]), [[0, null]], 'conv rejoined');
      return 'ok';
    }],

    ['open-ended last slab stays open', () => {
      const l = M.rulesToLadder([rule('base', 0, null, 'fixed', 1), rule('distance', 0, null, 'per_km', 10), rule('conv', 0, null, 'fixed', 5)]);
      eq(l.length, 1, 'one row'); eq(l[0].to, '', 'open');
      eq(M.ladderToRules(l).every(r => r.max_km === null), true, 'all open');
      return 'ok';
    }],

    ['a stored set with a hole shows the hole (empty cell, invalid)', () => {
      const l = M.rulesToLadder([rule('base', 0, null, 'fixed', 1), rule('distance', 2, null, 'per_km', 10), rule('conv', 0, null, 'fixed', 5)]);
      eq(l[0].cells.distance.mode, '', 'gap cell is empty, not silently filled');
      eq(M.validateLadder(l).ok, false, 'flagged');
      return 'ok';
    }],

    ['validate: blank, to <= from, open middle row, bad percent base, negative', () => {
      eq(M.validateLadder(M.blankLadder()).ok, false, 'blank');
      const ok = M.rulesToLadder(SHEET);
      eq(M.validateLadder(ok).ok, true, 'sheet is valid');

      let l = M.setSlabEnd(ok, ok[1].id, '3');          // 3.5 -> 3
      must(M.validateLadder(l).errors.some(e => /must be more than/.test(e)), 'to <= from not caught');

      l = M.setSlabEnd(ok, ok[0].id, '');               // first row open, but not last
      must(M.validateLadder(l).errors.some(e => /only the last slab/.test(e)), 'open middle row not caught');

      l = M.setCell(ok, ok[1].id, 'base', { ref: '0' });
      must(M.validateLadder(l).errors.some(e => /% of/.test(e)), 'ref 0 not caught');

      l = M.setCell(ok, ok[1].id, 'distance', { value: '-5' });
      must(M.validateLadder(l).errors.some(e => /0 or more/.test(e)), 'negative not caught');

      l = M.setCell(ok, ok[1].id, 'conv', { mode: 'fixed', value: '' });
      must(M.validateLadder(l).errors.some(e => /needs an amount/.test(e)), 'empty amount not caught');
      return 'ok';
    }],

    ['editing: from is derived, add closes an open slab, remove reopens the last', () => {
      let l = M.normalizeLadder([{ ...M.emptyRow('5') }, { ...M.emptyRow('') }]);
      eq(l.map(r => r.from), [0, 5], 'derived from');
      l = M.addSlab(l);
      eq(l.map(r => [r.from, r.to]), [[0, '5'], [5, '10'], [10, '']], 'open slab closed 5 km out, new one open');
      l = M.setSlabEnd(l, l[0].id, '4');
      eq(l.map(r => r.from), [0, 4, 10], 'changing a "to" moves the next "from"');
      l = M.removeSlab(l, l[2].id);
      eq(l[l.length - 1].to, '', 'last row reopened after removing the open one');
      eq(M.removeSlab(M.blankLadder(), M.blankLadder()[0].id).length, 1, 'the only slab cannot be removed');
      return 'ok';
    }],

    ['describeCell / money / kmLabel', () => {
      eq(M.describeCell({ mode: 'fixed', value: '95' }), { main: '₹95', sub: 'flat amount' }, 'fixed');
      eq(M.describeCell({ mode: 'per_km', value: '15' }).main, '₹15 / km', 'per km');
      eq(M.describeCell({ mode: 'percent', value: '40', ref: '80' }), { main: '40%', sub: 'of ₹80' }, 'percent');
      eq(M.describeCell({ mode: 'percent', value: '40', ref: '' }).sub, 'of the vehicle\u2019s base fare', 'percent of vehicle');
      eq(M.money('17.60'), '₹17.6', 'trailing zero'); eq(M.money(null), '—', 'null');
      const l = M.rulesToLadder(SHEET);
      eq([M.kmLabel(l[0]), M.kmLabel(l[3])], ['0 – 3.5 km', '10 – 15 km'], 'km labels');
      eq(M.kmLabel({ from: 15, to: '' }), '15 km and above', 'open label');
      return 'ok';
    }],

    ['riderTotal matches the engine: car 5 km off-peak = ₹133.12 with GST', () => {
      // ride fare 32 + 75 = 107 → ×1.05 = 112.35 ; conv 17.6 ×1.18 = 20.768 ; = 133.118
      eq(M.riderTotal({ rideFare: 107, conv: 17.6 }, { riderRatePct: 5, convFeeGstPct: 18 }), 133.12, 'total');
      return 'ok';
    }],

    ['previewWarnings: fare drop and uncovered distance are reported, a clean ladder is silent', () => {
      const gst = { riderRatePct: 5, convFeeGstPct: 18 };
      const clean = [
        { km: 5, ok: true, rideFare: 107, conv: 17.6 }, { km: 5.1, ok: true, rideFare: 104.5, conv: 24 },
      ];
      eq(M.previewWarnings(clean, gst).length, 0, '5 → 5.1 rises (133.12 → 135.3), no warning');
      const drop = [{ km: 10, ok: true, rideFare: 178, conv: 24 }, { km: 10.1, ok: true, rideFare: 150, conv: 20 }];
      must(M.previewWarnings(drop, gst).some(w => w.kind === 'drop'), 'drop not reported');
      const gap = [{ km: 15, ok: true, rideFare: 249, conv: 28 }, { km: 20, ok: false }];
      must(M.previewWarnings(gap, gst).some(w => w.kind === 'gap'), 'gap not reported');
      return 'ok';
    }],

    ['previewKms: boundaries and one step past each', () => {
      const ks = M.previewKms(M.rulesToLadder(SHEET));
      for (const k of [3.5, 3.6, 5, 5.1, 10, 10.1, 15, 15.1]) must(ks.includes(k), 'missing ' + k + ' in ' + ks);
      eq([...ks].sort((a, b) => a - b), ks, 'sorted');
      return 'ok';
    }],

    // ── Renders ────────────────────────────────────────────────────────────
    ['SlabsTab (loading)', () => render(SlabsTab, { onSaved: noop, onError: noop })],

    ['SlabLadderTable: sheet shows each range, amounts and the closed-end note', () => {
      const html = render(SlabLadderTable, { ladder: M.rulesToLadder(SHEET) });
      const t = visible(html);
      must(/0 – 3\\.5 km/.test(t) && /10 – 15 km/.test(t), 'ranges missing: ' + t);
      must(/₹95/.test(t) && /₹15 \\/ km/.test(t) && /40%/.test(t) && /of ₹80/.test(t), 'cells missing: ' + t);
      must(/Beyond 15 km the old pricing engine/.test(t), 'closed-end note missing');
      must(/Base fare/.test(t) && /Distance fare/.test(t) && /Convenience fee/.test(t), 'headers missing');
      return html;
    }],

    ['SlabLadderTable: open-ended set has no "beyond" note', () => {
      const l = M.rulesToLadder([rule('base', 0, null, 'fixed', 1), rule('distance', 0, null, 'per_km', 10), rule('conv', 0, null, 'fixed', 5)]);
      const html = render(SlabLadderTable, { ladder: l });
      must(!/Beyond/.test(visible(html)), 'note shown for an open-ended set');
      must(/0 km and above/.test(visible(html)), 'open label missing');
      return html;
    }],

    ['SlabSetCard: scope, vehicle, band, note and table', () => {
      const html = render(SlabSetCard, { set: SET, gst: {}, onEdit: noop, onCopy: noop, onDelete: noop });
      const t = visible(html);
      must(/Chandigarh/.test(t) && /car/.test(t) && /Off-peak/.test(t) && /Founder sheet/.test(t), 'header missing: ' + t);
      must(/Edit/.test(t) && /Copy to/.test(t) && /Remove/.test(t), 'actions missing');
      must(/Show fare examples/.test(t), 'examples toggle missing');
      must(!/Invalid/.test(t), 'valid set flagged invalid');
      return html;
    }],

    ['SlabSetCard: invalid set says it is ignored and why', () => {
      const html = render(SlabSetCard, { set: { ...SET, valid: false, errors: ['gap between 5 and 6 km'] }, gst: {}, onEdit: noop, onCopy: noop, onDelete: noop });
      const t = visible(html);
      must(/Invalid/.test(t) && /gap between 5 and 6 km/.test(t) && /old engine/.test(t), 'invalid state not explained: ' + t);
      return html;
    }],

    ['SlabSetCard: global set is labelled All cities', () => {
      const html = render(SlabSetCard, { set: { ...SET, scope: 'global', scope_id: null, scope_name: 'All cities' }, gst: {}, onEdit: noop, onCopy: noop, onDelete: noop });
      must(/All cities/.test(visible(html)), 'global label missing');
      return html;
    }],

    ['SlabPreviewTable: totals with GST, drop warning, uncovered row, backend errors', () => {
      const preview = [
        { km: 5, ok: true, base: 32, distance: 75, conv: 17.6, rideFare: 107, totalBeforeGst: 124.6 },
        { km: 10, ok: true, base: 28, distance: 150, conv: 24, rideFare: 178, totalBeforeGst: 202 },
        { km: 10.1, ok: true, base: 24, distance: 100, conv: 20, rideFare: 124, totalBeforeGst: 144 },
        { km: 20, ok: false, reason: 'NO_SLAB_BASE' },
      ];
      const html = render(SlabPreviewTable, { preview, gst: { riderRatePct: 5, convFeeGstPct: 18 }, errors: ['overlap at 5 km'] });
      const t = visible(html);
      must(/₹133\\.12/.test(t), 'rider total missing: ' + t);
      must(/Fare drops/.test(t), 'drop warning missing');
      must(/not covered/.test(t), 'uncovered row missing');
      must(/overlap at 5 km/.test(t), 'backend error missing');
      return html;
    }],

    ['SlabPreviewTable: clean set shows the green all-clear', () => {
      const preview = [
        { km: 5, ok: true, base: 32, distance: 75, conv: 17.6, rideFare: 107, totalBeforeGst: 124.6 },
        { km: 7, ok: true, base: 28, distance: 105, conv: 24, rideFare: 133, totalBeforeGst: 157 },
      ];
      const t = visible(render(SlabPreviewTable, { preview, gst: {}, errors: [] }));
      must(/never drops/.test(t), 'all-clear missing: ' + t);
      return t;
    }],

    ['ScopePicker: city search list, selected chips, live badge', () => {
      const html = render(ScopePicker, { scopes: SCOPES, scopeType: 'city', onScopeType: noop, stateId: null, onStateId: noop, cityIds: [108, 159], onCityIds: noop });
      const t = visible(html);
      must(/Chandigarh/.test(t) && /Panchkula/.test(t) && /Gurgaon/.test(t), 'cities missing: ' + t);
      must(/Live/.test(t), 'live badge missing');
      must(/city set always wins/.test(t), 'precedence hint missing');
      return html;
    }],

    ['ScopePicker: state and global modes', () => {
      const s = visible(render(ScopePicker, { scopes: SCOPES, scopeType: 'state', onScopeType: noop, stateId: 13, onStateId: noop, cityIds: [], onCityIds: noop }));
      must(/Haryana/.test(s), 'state list missing');
      const g = visible(render(ScopePicker, { scopes: SCOPES, scopeType: 'global', onScopeType: noop, stateId: null, onStateId: noop, cityIds: [], onCityIds: noop }));
      must(/whole country/.test(g), 'global warning missing');
      return g;
    }],

    ['ScopePicker: scopes not loaded yet does not crash', () => render(ScopePicker, { scopes: null, scopeType: 'city', onScopeType: noop, stateId: null, onStateId: noop, cityIds: [], onCityIds: noop })],

    ['mode labels say what they do, and each has a one-line explanation', () => {
      const labels = M.MODE_OPTIONS.map(o => o.label).join(' | ');
      must(/Flat amount/.test(labels) && /Rate per km/.test(labels) && /Percentage of an amount/.test(labels) && /Not charged/.test(labels), 'labels: ' + labels);
      for (const m of ['fixed', 'per_km', 'percent', 'none']) must(M.MODE_HELP[m] && M.MODE_HELP[m].length > 20, 'no help for ' + m);
      must(/7 km at ₹15 = ₹105/.test(M.MODE_HELP.per_km), 'per-km example missing');
      return 'ok';
    }],

    ['SlabEditor: a chosen mode shows its explanation under the dropdown', () => {
      const l = M.rulesToLadder(SHEET);
      const draft = { mode: 'edit', scope: 'city', scope_id: 108, scopeName: 'Chandigarh', vehicle: 'car', band: 'off_peak', note: '', ladder: l };
      const t = visible(render(SlabEditor, { draft, options: OPTIONS, scopes: SCOPES, existingSets: [], gst: {}, onCancel: noop, onChanged: noop, onSaved: noop, onError: noop }));
      must(/same amount for every trip in this slab/.test(t), 'flat help missing');
      must(/total km/.test(t) && /7 km at ₹15 = ₹105/.test(t), 'per-km help missing');
      must(/This % of the amount on the right/.test(t), 'percent help missing');
      return 'ok';
    }],

    ['SlabEditor (create): the three steps, add slab, disabled save', () => {
      const draft = { mode: 'create', scopeType: 'city', stateId: null, cityIds: [], vehicle: '', band: 'off_peak', note: '', ladder: M.blankLadder() };
      const html = render(SlabEditor, { draft, options: OPTIONS, scopes: SCOPES, existingSets: [SET], gst: {}, onCancel: noop, onChanged: noop, onSaved: noop, onError: noop });
      const t = visible(html);
      must(/New slab set/.test(t) && /Where and for whom/.test(t) && /2 · Slabs/.test(t) && /What the rider pays/.test(t), 'steps missing: ' + t);
      must(/Add slab/.test(t) && /Save slabs/.test(t), 'buttons missing');
      must(/Pick where this applies/.test(t), 'target hint missing');
      must(/Choose a vehicle/.test(t), 'vehicle prompt missing');
      must(/Copy slabs from/.test(t), 'copy-from missing');
      must(/<button[^>]*\\sdisabled=""[^>]*>(?:(?!<\\/button>).)*Save slabs/s.test(html), 'save must be disabled until the set is valid');
      return html;
    }],

    ['SlabEditor (edit): target fixed, ladder loaded, replace warning absent', () => {
      const draft = { mode: 'edit', scope: 'city', scope_id: 108, scopeName: 'Chandigarh', vehicle: 'car', band: 'off_peak', note: 'Founder sheet', ladder: M.rulesToLadder(SHEET) };
      const html = render(SlabEditor, { draft, options: OPTIONS, scopes: SCOPES, existingSets: [SET], gst: {}, onCancel: noop, onChanged: noop, onSaved: noop, onError: noop });
      const t = visible(html);
      must(/Edit slab set/.test(t) && /Chandigarh · car · Off-peak/.test(t), 'edit header missing: ' + t);
      must(/cannot be changed/.test(t), 'locked-target note missing');
      must(!/will replace slabs that already exist/.test(t), 'replace warning shown while editing');
      must(!/Search a city/.test(t), 'scope picker shown while editing');
      must(/Saves for Chandigarh/.test(t), 'target summary missing');
      must((html.match(/<tr/g) || []).length >= 5, 'one row per slab expected');
      return html;
    }],

    ['SlabEditor (copy): existing target warns it will replace', () => {
      const draft = { mode: 'create', copyOf: SET.key, scopeType: 'city', stateId: null, cityIds: [108, 159], vehicle: 'car', band: 'off_peak', note: '', ladder: M.rulesToLadder(SHEET) };
      const html = render(SlabEditor, { draft, options: OPTIONS, scopes: SCOPES, existingSets: [SET], gst: {}, onCancel: noop, onChanged: noop, onSaved: noop, onError: noop });
      const t = visible(html);
      must(/Copy slab set/.test(t), 'copy header missing');
      must(/will replace slabs that already exist/.test(t) && /Chandigarh already has/.test(t), 'replace warning missing: ' + t);
      must(/Will save 2 sets/.test(t) && /Save 2 sets/.test(t), 'multi-city summary missing');
      // a copy has no edits by definition — Save must still be live, or copying is impossible
      must(!/<button[^>]*\\sdisabled=""[^>]*>(?:(?!<\\/button>).)*Save 2 sets/s.test(html), 'Save is disabled on an unedited copy');
      return html;
    }],

  ];
`;

const out = path.join(os.tmpdir(), `slab-smoke-${process.pid}.cjs`);

await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  bundle: true, outfile: out, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.js': 'jsx', '.json': 'json' }, logLevel: 'warning',
  plugins: [{
    name: 'stub-api',
    setup(build) {
      build.onResolve({ filter: /api\/opsApi\.js$/ }, () => ({ path: 'opsApi-stub', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: apiStub, loader: 'js' }));
    },
  }],
});

const origWarn = console.error;
console.error = (...a) =>
  (String(a[0] || '').includes('useLayoutEffect does nothing on the server') ? undefined : origWarn(...a));

let pass = 0, fail = 0;
try {
  const { createRequire } = await import('module');
  createRequire(import.meta.url)(out);
  for (const [name, run] of globalThis.__cases) {
    try {
      const html = run();
      if (!html || html.length < 2) throw new Error(`rendered almost nothing (${html?.length} chars)`);
      console.log(`  ✓ ${name}`);
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
