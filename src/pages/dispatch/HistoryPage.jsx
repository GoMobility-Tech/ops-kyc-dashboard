import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History, Radio, ChevronRight, ChevronDown, Phone, Clock, UserX, EyeOff, Search,
} from 'lucide-react';
import { getDispatchHistory } from '../../api/opsApi.js';
import useUrlFilters from '../../utils/useUrlFilters.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD, Select, SearchBar,
} from '../../components/ui';
import {
  num, fmtWait, fmtRupees, fmtTime, telHref, waitLabel, isSearching,
  STATUS_FILTERS, DAY_FILTERS, statusTone,
} from './dispatchMeta.js';

const PAGE_SIZE = 50;

// Filters live in the URL, so a support person can paste the link into a
// ticket and whoever opens it sees the same result.
const DEFAULT_FILTERS = { q: '', days: '10', status: '' };

// What the offers column means depends on whether we were recording at all
// when this ride went out. Getting this wrong is the easiest way to mislead
// someone: an empty list on an old ride is a blind spot, not evidence that no
// driver was contacted.
// Exported (with the __ prefix) only so scripts/render-smoke.mjs can render
// these two in isolation. The tracked/untracked branch is the part that would
// actively mislead support if it went wrong, so it is worth asserting directly.
export function __OffersCell({ row }) {
  const count = num(row.offers_recorded) ?? 0;

  if (!row.offers_tracked) {
    return (
      <Badge tone="neutral" icon={EyeOff} className="cursor-help">
        <span title="Dispatch recording was not live yet when this ride went out, so we do not know which drivers were contacted.">
          Not recorded
        </span>
      </Badge>
    );
  }
  if (count === 0) {
    return (
      <Badge tone="danger" icon={UserX} className="cursor-help">
        <span title="No eligible driver was online in that area">Reached nobody</span>
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-base font-bold text-accent-navy tabular-nums leading-none">
        {count}
      </span>
      <span className="text-[10px] text-ink-muted leading-tight">
        driver{count === 1 ? '' : 's'}
      </span>
    </span>
  );
}

export function __HistoryRow({ row, onOpen }) {
  const tel = telHref(row.passenger_phone);
  return (
    <TR onClick={onOpen}>
      <TD>
        <p className="text-xs font-mono text-ink truncate max-w-[150px]" title={row.ride_number}>
          {row.ride_number || `#${row.ride_id}`}
        </p>
        <p className="text-[10px] text-ink-faint tabular-nums">{fmtTime(row.requested_at)}</p>
      </TD>

      <TD>
        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
      </TD>

      <TD>
        <p className="text-ink font-medium text-sm truncate max-w-[150px]">
          {row.passenger_name || 'Unknown'}
        </p>
        {tel ? (
          <a
            href={tel}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-accent-navy hover:text-brand-700 font-medium inline-flex items-center gap-1"
          >
            <Phone size={9} />{row.passenger_phone}
          </a>
        ) : (
          <span className="text-[11px] text-ink-faint">No phone</span>
        )}
      </TD>

      <TD>
        <div className="max-w-[260px] space-y-0.5">
          <p className="text-[11px] text-ink truncate" title={row.pickup_address}>
            <span className="text-green-700 font-bold">●</span> {row.pickup_address || '—'}
          </p>
          <p className="text-[11px] text-ink-muted truncate" title={row.dropoff_address}>
            <span className="text-red-600 font-bold">●</span> {row.dropoff_address || '—'}
          </p>
        </div>
      </TD>

      <TD>
        <span className="text-xs text-ink tabular-nums inline-flex items-center gap-1">
          <Clock size={11} className="text-ink-muted" />{fmtWait(row.waiting_minutes)}
        </span>
        <p className="text-[10px] text-ink-faint">{waitLabel(row.status)}</p>
      </TD>

      <TD><__OffersCell row={row} /></TD>

      <TD align="right">
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onOpen}
            title="See which drivers were notified"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
          >
            Drivers <ChevronRight size={12} />
          </button>
        </div>
      </TD>
    </TR>
  );
}

export default function HistoryPage() {
  const nav = useNavigate();
  const [f, setFilter, resetFilters, isFiltered] = useUrlFilters(DEFAULT_FILTERS);
  const [rows,        setRows]        = useState([]);
  const [meta,        setMeta]        = useState({});
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');

  const fetchList = useCallback(async ({ append = false, from = 0 } = {}) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res = await getDispatchHistory({
        search: f.q, days: f.days, status: f.status, limit: PAGE_SIZE, offset: from,
      });
      const d = res.data?.data || {};
      setRows(prev => (append ? [...prev, ...(d.rides || [])] : (d.rides || [])));
      setMeta(d);
      setHasMore(Boolean(d.has_more));
      setOffset(from);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load ride history');
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [f]);

  useEffect(() => { fetchList({ from: 0 }); }, [fetchList]);

  const untracked = rows.filter(r => !r.offers_tracked).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">Ride History</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Look up any past ride and see which drivers its request reached
          </p>
        </div>
        <Button variant="outline" size="sm" icon={Radio} onClick={() => nav('/dispatch')}>
          Live requests
        </Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
              Search
            </label>
            <SearchBar
              value={f.q}
              onSubmit={(v) => (v === f.q ? fetchList({ from: 0 }) : setFilter({ q: v }))}
              placeholder="Ride ID, ride number, or passenger phone…"
              hint="Searching ignores the date range — a ride number or phone will find the ride however old it is."
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Date range"
              value={f.days}
              onChange={(v) => setFilter({ days: v })}
              options={DAY_FILTERS}
              disabled={Boolean(f.q)}
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Status"
              value={f.status}
              onChange={(v) => setFilter({ status: v })}
              options={STATUS_FILTERS}
              placeholder="Any status"
            />
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
          )}
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* The one thing that will genuinely confuse people if left unsaid. */}
      {untracked > 0 && (
        <Alert tone="warning">
          <strong>{untracked}</strong> of these rides {untracked === 1 ? 'was' : 'were'} requested
          before per-driver dispatch recording went live
          {meta.tracking_since ? ` on ${fmtTime(meta.tracking_since)}` : ''}, so we cannot show
          which drivers were contacted. Those rows say <strong>Not recorded</strong> — that is a
          gap in our data, not proof that nobody was contacted.
        </Alert>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={f.q ? Search : History}
          title={f.q ? 'Nothing matched that search' : 'No rides in this range'}
          description={
            f.q
              ? 'Check the ride number or phone and try again. A ride ID, a full ride number, or a 10-digit passenger phone all work.'
              : 'Widen the date range, or clear the status filter.'
          }
          action={isFiltered && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>Reset filters</Button>
          )}
        />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">
            Showing {rows.length} ride{rows.length === 1 ? '' : 's'}
            {meta.searched
              ? ' matching your search (all time)'
              : meta.days_window ? ` from the last ${meta.days_window} days` : ''}
          </p>

          <Table>
            <THead>
              <tr>
                <TH>Ride</TH>
                <TH>Status</TH>
                <TH>Passenger</TH>
                <TH>Route</TH>
                <TH>Wait</TH>
                <TH>Notified</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map(row => (
                <__HistoryRow
                  key={row.ride_id}
                  row={row}
                  onOpen={() => nav(`/dispatch/${row.ride_id}`)}
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
              onClick={() => fetchList({ append: true, from: offset + PAGE_SIZE })}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
