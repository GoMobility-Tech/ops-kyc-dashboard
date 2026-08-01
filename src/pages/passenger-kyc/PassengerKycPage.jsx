import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Flag, ChevronRight, ChevronDown, ScanFace } from 'lucide-react';
import { getPassengerKycList } from '../../api/opsApi.js';
import useUrlFilters from '../../utils/useUrlFilters.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD, Select, SearchBar,
} from '../../components/ui';
import FlagChips from './FlagChips.jsx';
import {
  STATUS_META, STATUS_FILTERS, FLAG_FILTERS,
  FACE_MATCH_DEFAULT_THRESHOLD, fmtTime,
} from './passengerMeta.js';

const PAGE_SIZE = 20;

// Filters live in the URL — see useUrlFilters. Watchlist first by default.
const DEFAULT_FILTERS = { flagged: '1', status: '', q: '' };

function FaceScore({ score }) {
  if (score == null) return <span className="text-[11px] text-ink-faint">—</span>;
  const low = score < FACE_MATCH_DEFAULT_THRESHOLD;
  return (
    <span
      title={`Threshold ${FACE_MATCH_DEFAULT_THRESHOLD}`}
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums
        ${low ? 'text-red-600' : 'text-green-700'}`}
    >
      <ScanFace size={12} />{score}
    </span>
  );
}

function PassengerRow({ row, onOpen }) {
  const status = row.status || 'not_started';
  const meta   = STATUS_META[status] || STATUS_META.not_started;
  const Icon   = meta.icon;
  const name   = row.full_name || 'Unknown';

  return (
    <TR onClick={onOpen}>
      <TD>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-accent-navy text-brand-400 font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-brand-500/40">
            {name[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-ink font-medium text-sm truncate max-w-[200px]">{name}</p>
            <p className="text-ink-muted text-[11px] truncate">
              {row.phone_number || '—'}{row.go_id ? ` · ${row.go_id}` : ''}
            </p>
          </div>
        </div>
      </TD>
      <TD>
        <Badge tone={meta.tone} icon={Icon}>{meta.label}</Badge>
      </TD>
      <TD>
        {row.is_flagged
          ? <FlagChips flags={row.flag_reasons} max={2} />
          : <span className="text-[11px] text-ink-faint">Clean</span>}
      </TD>
      <TD>
        <FaceScore score={row.face_match_score} />
      </TD>
      <TD>
        <span className="text-[11px] text-ink-muted whitespace-nowrap">
          {fmtTime(row.last_activity_at || row.user_created_at)}
        </span>
      </TD>
      <TD align="right">
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onOpen}
            title="Open passenger record"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
          >
            Open <ChevronRight size={12} />
          </button>
        </div>
      </TD>
    </TR>
  );
}

export default function PassengerKycPage() {
  const nav = useNavigate();
  const [f, setFilter] = useUrlFilters(DEFAULT_FILTERS);
  const [rows,        setRows]        = useState([]);
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');

  const fetchList = useCallback(async ({ append = false, pg = 1 } = {}) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res  = await getPassengerKycList({
        flagged: f.flagged, status: f.status, search: f.q, page: pg, limit: PAGE_SIZE,
      });
      const data  = res.data?.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      setRows(prev => append ? [...prev, ...items] : items);
      setTotal(data?.total ?? items.length);
      setHasMore(items.length === PAGE_SIZE);
      setPage(pg);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load passengers');
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [f]);

  useEffect(() => { fetchList({ pg: 1 }); }, [fetchList]);

  const openPassenger = (row) => {
    if (row.user_id) nav(`/passenger-kyc/${row.user_id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">Passenger KYC</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Watchlist &amp; record lookup — documents auto-verify, ops only review flags
          </p>
        </div>
      </div>

      <Alert tone="info">
        No approval queue here. Passenger documents verify automatically on OCR, and a flag
        never blocks anyone from booking rides — it just marks a record worth a look.
      </Alert>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
              Search
            </label>
            <SearchBar
              value={f.q}
              onSubmit={(v) => (v === f.q ? fetchList({ pg: 1 }) : setFilter({ q: v }))}
              placeholder="Phone, name, email, or GO ID…"
            />
          </div>
          <div className="min-w-[170px]">
            <Select
              label="Flags"
              value={f.flagged}
              onChange={(v) => setFilter({ flagged: v })}
              options={FLAG_FILTERS}
              placeholder="All passengers"
            />
          </div>
          <div className="min-w-[170px]">
            <Select
              label="KYC status"
              value={f.status}
              onChange={(v) => setFilter({ status: v })}
              options={STATUS_FILTERS}
              placeholder="All statuses"
            />
          </div>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={f.flagged === '1' ? Flag : Users}
          title={f.flagged === '1' ? 'No flagged passengers' : 'No passengers found'}
          description={
            f.flagged === '1'
              ? 'Nothing on the watchlist right now — switch to "All passengers" to browse everyone.'
              : f.q ? 'Try a different search term or filter' : 'No records match these filters'
          }
          action={f.flagged !== '' && (
            <Button variant="secondary" size="sm" onClick={() => setFilter({ flagged: '' })}>
              Show all passengers
            </Button>
          )}
        />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">
            Showing {rows.length}{total ? ` of ${total}` : ''}
            {f.flagged === '1' ? ' flagged' : ''}
          </p>
          <Table>
            <THead>
              <tr>
                <TH>Passenger</TH>
                <TH>Status</TH>
                <TH>Flags</TH>
                <TH>Face</TH>
                <TH>Last activity</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map(row => (
                <PassengerRow
                  key={row.user_id}
                  row={row}
                  onOpen={() => openPassenger(row)}
                />
              ))}
            </TBody>
          </Table>

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              icon={ChevronDown}
              loading={loadingMore}
              onClick={() => fetchList({ append: true, pg: page + 1 })}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
