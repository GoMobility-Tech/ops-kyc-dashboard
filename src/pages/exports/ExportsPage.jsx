import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileSpreadsheet, History, CheckCircle2 } from 'lucide-react';
import { Tabs, Alert, Spinner } from '../../components/ui';
import { getExportCatalog, listExports } from '../../api/opsApi.js';
import NewExportTab from './NewExportTab.jsx';
import HistoryTab   from './HistoryTab.jsx';

// ─── Data Exports ───────────────────────────────────────────────────────────
//
// Do tab: naya export maango, aur pichhle saare exports dekho.
//
// Teen cheezein is screen ki shakl tay karti hain:
//
//   1. Filters backend se aate hain. `/admin/exports/catalog` har dataset ke
//      filters, unke type aur city groups deta hai. Backend me naya filter
//      add karne pe yahan kuch nahi badalta.
//
//   2. File banne me waqt lagta hai. HTTP request turant lautti hai aur worker
//      peeche kaam karta hai — isliye jab tak koi file ban rahi hai, list
//      apne aap refresh hoti hai. Refresh band ho jaata hai jaise hi sab ready
//      ya failed ho jaayein, warna ye screen khali baithe bhi DB peet‌ti rehti.
//
//   3. Download link har baar naya banta hai. Isliye purani file ke liye kuch
//      alag nahi karna padta — wahi button, wahi rasta.

const POLL_MS = 4000;

export default function ExportsPage() {
  const [tab, setTab] = useState('new');
  const [catalog, setCatalog] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [listFilters, setListFilters] = useState({ dataset: '', status: '', mine: false });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const firstLoad = useRef(true);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await getExportCatalog();
      setCatalog(res.data?.data || null);
      setError('');
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Your account can open this screen but is not allowed to read the export catalog. It needs the Data Exports module.'
        : (err.response?.data?.message || 'Could not load the export catalog'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = useCallback(async (offset = pagination.offset) => {
    if (firstLoad.current) setListLoading(true);
    try {
      const res = await listExports({
        dataset: listFilters.dataset || undefined,
        status:  listFilters.status || undefined,
        mine:    listFilters.mine || undefined,
        limit:   pagination.limit,
        offset,
      });
      const data = res.data?.data || {};
      setRows(data.exports || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the export list');
    } finally {
      setListLoading(false);
      firstLoad.current = false;
    }
  }, [listFilters, pagination.limit, pagination.offset]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadList(0); /* filter badla → pehle page pe */ }, [listFilters]); // eslint-disable-line

  // Sirf tab tak poll karo jab tak kuch ban raha ho.
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

  const onQueued = (message) => {
    setError('');
    setFlash(message);
    setTab('history');   // file wahin dikhegi, isliye seedha wahan le jao
    loadList(0);
  };

  const TABS = [
    { value: 'new',     label: 'New export', icon: FileSpreadsheet },
    { value: 'history', label: 'History',    icon: History, count: pagination.total || undefined },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-accent-navy">Data Exports</h2>
        <p className="text-xs text-ink-muted mt-0.5 max-w-2xl leading-relaxed">
          Pull passenger or driver data as Excel with any combination of filters. The file is
          built in the background, stored, and stays downloadable — every download is recorded.
        </p>
      </div>

      {flash && (
        <Alert tone="success" onClose={() => setFlash('')}>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> {flash}</span>
        </Alert>
      )}
      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : tab === 'new' ? (
        <NewExportTab
          catalog={catalog}
          onQueued={onQueued}
          onError={setError}
        />
      ) : (
        <HistoryTab
          rows={rows}
          pagination={pagination}
          loading={listLoading}
          datasets={catalog?.datasets}
          filters={listFilters}
          onFilterChange={setListFilters}
          onPage={(offset) => loadList(Math.max(0, offset))}
          onRefresh={() => loadList()}
          onError={setError}
          onDownloaded={() => loadList()}
        />
      )}
    </div>
  );
}
