/**
 * Data Exports screen ko server pe sach me render karta hai.
 *
 *   npm run smoke:exports
 *
 * `vite build` un galtiyon se guzar jaata hai jo sirf chalane pe phat‌ti hain
 * (dispatch ka TDZ crash isi tarah green build ke saath ship hua tha).
 *
 * Payload production se liya gaya hai — 522 asli cities, asli KYC statuses.
 * Isse wo cheezein pakdi jaati hain jo hand-made data pe chhup jaati: 522
 * options ka dropdown, aur wo statuses jo DB me hain hi nahi.
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
  export const getExportCatalog = never;
  export const listExports = never;
  export const previewExport = never;
  export const createExport = never;
  export const getExportJob = never;
  export const getExportDownloadUrl = never;
`;

const entry = `
  import React from 'react';
  import { renderToString } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import ExportsPage  from '${root}/src/pages/exports/ExportsPage.jsx';
  import FilterPanel  from '${root}/src/pages/exports/FilterPanel.jsx';
  import FilterField  from '${root}/src/pages/exports/FilterField.jsx';
  import JobsTable    from '${root}/src/pages/exports/JobsTable.jsx';
  import MultiPicker  from '${root}/src/pages/exports/MultiPicker.jsx';
  import { cleanFilters, countFilters, fmtBytes, fmtCount }
    from '${root}/src/pages/exports/exportMeta.js';
  import payload from '${root}/src/pages/exports/__fixtures__/exportsPayload.json';

  const noop = () => {};
  const render = (El, props) => renderToString(
    React.createElement(MemoryRouter, null, React.createElement(El, props)));
  const text = (h) => h.replace(/<!--.*?-->/g, '').replace(/<[^>]*>/g, ' ');
  const must = (c, m) => { if (!c) throw new Error(m); };

  const catalog    = payload.catalog;
  const passengers = catalog.datasets.find(d => d.key === 'passengers');
  const drivers    = catalog.datasets.find(d => d.key === 'drivers');

  globalThis.__cases = [
    ['ExportsPage (loading)', () => render(ExportsPage)],

    ['FilterPanel — passengers, real catalog', () => {
      const html = render(FilterPanel, {
        dataset: passengers, draft: {}, onChange: noop, onClear: noop, catalog,
        preview: null, busy: '', onCount: noop, onBuild: noop,
      });
      const t = text(html);
      must(/none of 28/.test(t), 'the applied-count summary is missing');
      must(/Count rows/.test(t) && /Build Excel/.test(t), 'actions are not in the toolbar');
      // Pehla section khula, baaki band — warna jobs table screen se neeche
      must(/Identity/i.test(t), 'first section is not open');
      return html;
    }],

    ['FilterPanel — drivers', () => {
      const html = render(FilterPanel, {
        dataset: drivers, draft: {}, onChange: noop, onClear: noop, catalog,
        preview: null, busy: '', onCount: noop, onBuild: noop,
      });
      must(/none of 31/.test(text(html)), 'driver filter count wrong');
      return html;
    }],

    // ── Design ki shart: chips nahi, dropdown ──────────────────────────────
    ['boolean filter dropdown hai, teen chips nahi', () => {
      const spec = { key: 'is_active', label: 'Active account', type: 'boolean' };
      const html = render(FilterField, { spec, value: '', onChange: noop });
      const t = text(html);
      must(/Any/.test(t), 'Any option missing');
      // Band dropdown me "Yes" aur "No" dikhne hi nahi chahiye
      must(!/\\bYes\\b/.test(t) && !/\\bNo\\b/.test(t),
        'Yes/No are on screen — this is still the chip layout');
      return html;
    }],

    ['filter lagane ke liye kahin chips nahi hain', () => {
      // Ye poore redesign ki shart hai. Pehla version har boolean ko teen
      // chips me aur har group ko chips ki line me dikhata tha.
      const html = render(FilterPanel, {
        dataset: passengers, draft: {}, onChange: noop, onClear: noop, catalog,
        preview: null, busy: '', onCount: noop, onBuild: noop,
      });
      must(!/rounded-full/.test(html),
        'a pill/chip control is still being rendered in the filter panel');
      return html;
    }],

    ['multiselect bhi dropdown hai', () => {
      const spec = passengers.filterGroups.flatMap(g => g.filters).find(f => f.type === 'multiselect');
      must(spec, 'no multiselect filter in the catalog');
      const html = render(FilterField, { spec, value: [], onChange: noop });
      must(/Any/.test(text(html)), 'closed multiselect should read Any');
      return html;
    }],

    // ── KYC statuses DB se aate hain ──────────────────────────────────────
    ['KYC options wahi hain jo DB me hain', () => {
      const pk = passengers.filterGroups.flatMap(g => g.filters).find(f => f.key === 'kyc_status');
      const dk = drivers.filterGroups.flatMap(g => g.filters).find(f => f.key === 'kyc_status');
      const pv = pk.options.map(o => o.value).sort();
      must(JSON.stringify(pv) === JSON.stringify(['in_progress', 'verified']),
        'passenger KYC options do not match production: ' + pv.join(','));
      must(dk.options.length === 6, 'driver KYC should have 6 live statuses, got ' + dk.options.length);
      must(dk.options.every(o => o.label[0] === o.label[0].toUpperCase()),
        'labels are still raw snake_case');
      return 'ok';
    }],

    // ── Cities backend se, teen group buttons se nahi ─────────────────────
    ['city filter asli list se banta hai', () => {
      must(catalog.cities.length > 500,
        'catalog carries only ' + catalog.cities.length + ' cities — the full list is not being sent');
      const spec = passengers.filterGroups.flatMap(g => g.filters).find(f => f.type === 'city');
      const html = render(FilterField, {
        spec, value: {}, onChange: noop,
        cityGroups: catalog.cityGroups, cities: catalog.cities,
      });
      must(/Any city/.test(text(html)), 'city picker placeholder missing');
      return html;
    }],

    ['chuni hui cities band dropdown pe naam se dikhti hain', () => {
      const spec = passengers.filterGroups.flatMap(g => g.filters).find(f => f.type === 'city');
      const chandigarh = catalog.cities.find(c => c.label === 'Chandigarh');
      const html = render(FilterField, {
        spec, value: { ids: [chandigarh.value] }, onChange: noop,
        cityGroups: catalog.cityGroups, cities: catalog.cities,
      });
      must(/Chandigarh/.test(text(html)), 'the chosen city is not shown');
      return html;
    }],

    ['group aur city dono chune to dono dikhte hain', () => {
      const spec = passengers.filterGroups.flatMap(g => g.filters).find(f => f.type === 'city');
      const html = render(FilterField, {
        spec, value: { groups: ['ncr'], ids: [40] }, onChange: noop,
        cityGroups: catalog.cityGroups, cities: catalog.cities,
      });
      const t = text(html);
      must(/Delhi NCR/.test(t), 'group label missing from the summary');
      must(/added together/.test(t), 'the add-not-narrow hint is missing');
      return html;
    }],

    ['522 options render karne pe screen nahi girti', () => {
      const html = render(MultiPicker, {
        label: 'City', options: catalog.cities, value: [], onChange: noop,
      });
      must(html.length > 50, 'picker rendered nothing');
      // Band dropdown me 522 rows DOM me nahi aani chahiye
      must(html.length < 20000, 'closed picker is rendering the whole list: ' + html.length + ' chars');
      return html;
    }],

    // ── Jobs table ────────────────────────────────────────────────────────
    ['JobsTable — chaaron status', () => {
      const html = render(JobsTable, {
        rows: payload.jobs, pagination: payload.pagination,
        datasets: catalog.datasets, filters: {},
        onFilterChange: noop, onPage: noop, onRefresh: noop,
        onError: noop, onDownloaded: noop,
      });
      const t = text(html);
      must(/Ready/.test(t), 'ready status missing');
      must(/Building/.test(t), 'running status missing');
      must(/Failed/.test(t), 'failed status missing');
      must(/Queued/.test(t), 'queued status missing');
      must(/connection terminated/.test(t), 'the failure reason is hidden');
      must(/Download/.test(t), 'download action missing on the ready row');
      must(/182/.test(t), 'row count missing');
      must(/59 KB/.test(t), 'file size missing');
      must(/origin not recorded/.test(t), 'a job with no IP should say so, not render blank');
      return html;
    }],

    ['JobsTable — khaali list', () => {
      const html = render(JobsTable, {
        rows: [], pagination: { total: 0, limit: 20, offset: 0 },
        datasets: catalog.datasets, filters: {},
        onFilterChange: noop, onPage: noop, onRefresh: noop, onError: noop, onDownloaded: noop,
      });
      must(/No exports yet/.test(text(html)), 'empty state missing');
      return html;
    }],

    // ── Filters backend ko jaate waqt ─────────────────────────────────────
    ['khaali filters backend ko nahi jaate', () => {
      const out = cleanFilters({
        search: '', city: { groups: [], ids: [] }, rating: { min: '', max: '' },
        is_active: '', vehicle_type: [], kyc_status: ['verified'],
      });
      must(JSON.stringify(out) === JSON.stringify({ kyc_status: ['verified'] }),
        'empty filters leaked: ' + JSON.stringify(out));
      return 'ok';
    }],

    ['aadha bhara range bhi jaata hai', () => {
      const out = cleanFilters({ rating: { min: '4', max: '' } });
      must(JSON.stringify(out) === JSON.stringify({ rating: { min: '4' } }),
        'partial range was dropped: ' + JSON.stringify(out));
      return 'ok';
    }],

    ['filter ginti wahi hai jo backend ko jayegi', () => {
      must(countFilters({ a: '', b: [], c: 'x' }) === 1, 'count is wrong');
      must(countFilters({ city: { groups: ['ncr'] } }) === 1, 'city filter not counted');
      must(countFilters({ city: { groups: [], ids: [] } }) === 0, 'empty city counted');
      return 'ok';
    }],

    ['file size padhne layak hai', () => {
      must(fmtBytes(60505) === '59 KB', fmtBytes(60505));
      must(fmtBytes(0) === '—', 'zero should be a dash, not 0 B');
      must(fmtCount(1234) === '1,234', fmtCount(1234));
      return 'ok';
    }],
  ];
`;

const out = path.join(os.tmpdir(), `exports-smoke-${process.pid}.cjs`);

await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  bundle: true, outfile: out, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.js': 'jsx', '.json': 'json' }, logLevel: 'warning',
  plugins: [{
    name: 'stub-api',
    setup(build) {
      build.onResolve({ filter: /api\/opsApi\.js$/ }, () => ({ path: 'stub', namespace: 'stub' }));
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
      if (!html || html.length < 2) throw new Error(`rendered almost nothing`);
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
