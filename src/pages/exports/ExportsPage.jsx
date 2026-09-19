import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Spinner, Select } from '../../components/ui';
import { getExportCatalog, listExports, previewExport, createExport } from '../../api/opsApi.js';
import FilterPanel from './FilterPanel.jsx';
import JobsTable    from './JobsTable.jsx';
import { cleanFilters } from './exportMeta.js';

// ─── Data Exports ───────────────────────────────────────────────────────────
//
// Ek hi screen: upar filters, neeche exports ki table.
//
// Tabs hatane ki wajah — file banne me waqt lagta hai, aur "Build Excel" dabane
// ke baad user ko turant dikhna chahiye ki uska job line me lag gaya. Alag tab
// me bhejne ka matlab tha ki wo har baar switch karke dekhe. Ab dono ek saath
// dikhte hain.
//
// Filters backend ke catalog se aate hain — dataset ke filters, unke options,
// aur poori city list. Backend me naya filter add karne pe yahan kuch nahi
// badalta.

const POLL_MS = 4000;

export default function ExportsPage() {
  const [catalog, setCatalog] = useState(null);
  const [datasetKey, setDatasetKey] = useState('');
  const [draft, setDraft] = useState({});
  const [preview, setPreview] = useState(null);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [listFilters, setListFilters] = useState({ dataset: '', status: '', mine: false });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const firstLoad = useRef(true);

  const datasets = catalog?.datasets || [];
  const dataset = useMemo(
    () => datasets.find(d => d.key === datasetKey) || null,
    [datasets, datasetKey],
  );

  // ── Catalog ──
  useEffect(() => {
    (async () => {
      try {
        const res = await getExportCatalog();
        const data = res.data?.data || null;
        setCatalog(data);
        setDatasetKey(data?.datasets?.[0]?.key || '');
        setError('');
      } catch (err) {
        setError(err.response?.status === 403
          ? 'Your account can open this screen but is not allowed to read the export catalog. It needs the Data Exports module.'
          : (err.response?.data?.message || 'Could not load the export catalog'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Jobs list ──
  const loadList = useCallback(async (offset) => {
    const at = offset ?? pagination.offset;
    try {
      const res = await listExports({
        dataset: listFilters.dataset || undefined,
        status:  listFilters.status || undefined,
        mine:    listFilters.mine || undefined,
        limit:   pagination.limit,
        offset:  at,
      });
      const data = res.data?.data || {};
      setRows(data.exports || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the export list');
    } finally {
      firstLoad.current = false;
    }
  }, [listFilters, pagination.limit, pagination.offset]);

  useEffect(() => { loadList(0); }, [listFilters]); // eslint-disable-line

  // Sirf tab tak poll karo jab tak kuch ban raha ho — warna khali baithi
  // screen bhi har 4 second server peet‌ti rehti.
  useEffect(() => {
    const building = rows.some(r => r.status === 'queued' || r.status === 'running');
    if (!building) return;
    const id = setInterval(() => loadList(), POLL_MS);
    return () => clearInterval(id);
  }, [rows, loadList]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(id);
  }, [flash]);

  // Dataset badla to filters reset — ek dataset ke filter doosre pe lagte hi
  // nahi, aur backend unhe unknown bol ke 400 deta hai.
  const switchDataset = (key) => {
    setDatasetKey(key);
    setDraft({});
    setPreview(null);
  };

  const setFilter = (key, value) => {
    setDraft(d => ({ ...d, [key]: value }));
    setPreview(null);   // filter badalte hi purana count jhoot ban jaata hai
  };

  const runPreview = async () => {
    setBusy('preview');
    try {
      const res = await previewExport(datasetKey, cleanFilters(draft));
      setPreview(res.data?.data || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not count the rows');
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('create');
    try {
      const res = await createExport(datasetKey, cleanFilters(draft));
      setFlash(res.data?.message || 'Export queued');
      setError('');
      loadList(0);
    } catch (err) {
      setError(err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Could not queue the export');
    } finally { setBusy(''); }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">Data Exports</h2>
          <p className="text-xs text-ink-muted mt-0.5 max-w-2xl leading-relaxed">
            Pull passenger or driver data as Excel with any combination of filters. The file is
            built in the background and stays downloadable — every download is recorded.
          </p>
        </div>
        {datasets.length > 0 && (
          <Select
            label="What to export"
            value={datasetKey}
            onChange={switchDataset}
            options={datasets.map(d => ({ value: d.key, label: d.label }))}
            className="w-56"
          />
        )}
      </div>

      {flash && (
        <Alert tone="success" onClose={() => setFlash('')}>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> {flash}</span>
        </Alert>
      )}
      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : (
        <>
          <FilterPanel
            dataset={dataset}
            draft={draft}
            onChange={setFilter}
            onClear={() => { setDraft({}); setPreview(null); }}
            catalog={catalog}
            preview={preview}
            busy={busy}
            onCount={runPreview}
            onBuild={submit}
          />

          <JobsTable
            rows={rows}
            pagination={pagination}
            datasets={datasets}
            filters={listFilters}
            onFilterChange={setListFilters}
            onPage={(offset) => loadList(Math.max(0, offset))}
            onRefresh={() => loadList()}
            onError={setError}
            onDownloaded={() => loadList()}
          />
        </>
      )}
    </div>
  );
}
