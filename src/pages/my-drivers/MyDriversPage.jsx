import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, UserPlus, Users, CheckCircle2, AlertTriangle,
  Clock, XCircle, Ban, CircleDashed, RefreshCw, ChevronDown, ListChecks,
} from 'lucide-react';
import { hasModule } from '../../utils/auth.js';
import { getMyStats, getMyDrivers } from '../../api/opsApi.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD, Select, SearchBar, DateRangeFilter,
} from '../../components/ui';
import DocStatusStrip from '../../components/driver/DocStatusStrip.jsx';
import DocStatusLegend from '../../components/driver/DocStatusLegend.jsx';
import { computePct, countVerified, TOTAL_DOCS, hasPerDocData } from '../../components/driver/driverStatus.js';

const STATUS_META = {
  verified:       { label: 'Verified',       tone: 'success', icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',    tone: 'warning', icon: Clock },
  pending_review: { label: 'Review',         tone: 'info',    icon: AlertTriangle },
  rejected:       { label: 'Rejected',       tone: 'danger',  icon: XCircle },
  suspended:      { label: 'Suspended',      tone: 'warning', icon: Ban },
  not_started:    { label: 'Not Started',    tone: 'neutral', icon: CircleDashed },
};

const FILTERS = [
  { key: '',               label: 'All',         statKey: 'totalDrivers'   },
  { key: 'verified',       label: 'Verified',    statKey: 'verified'       },
  { key: 'pending_review', label: 'Review',      statKey: 'pendingReview'  },
  { key: 'in_progress',    label: 'In Progress', statKey: 'inProgress'     },
  { key: 'rejected',       label: 'Rejected',    statKey: 'rejected'       },
  { key: 'not_started',    label: 'Not Started', statKey: 'notStarted'     },
  { key: 'suspended',      label: 'Suspended',   statKey: 'suspended'      },
];

function pick(row, ...keys) {
  for (const k of keys) if (row?.[k] != null) return row[k];
  return null;
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-ink-muted text-[10px] uppercase tracking-wider truncate">{label}</span>
        {Icon && <Icon size={13} className="text-accent-navy shrink-0" />}
      </div>
      <p className="text-accent-navy font-bold text-lg sm:text-xl">{value ?? '—'}</p>
    </Card>
  );
}

function DriverTableRow({ driver, onClick }) {
  const status = pick(driver, 'overallStatus', 'overall_status') || 'not_started';
  const meta   = STATUS_META[status] || STATUS_META.not_started;
  const Icon   = meta.icon;
  const name   = pick(driver, 'fullName', 'full_name') || 'Unknown';
  const phone  = pick(driver, 'phoneNumber', 'phone_number', 'phone');
  const goId   = pick(driver, 'goId', 'go_id');
  const verified   = countVerified(driver);
  const pct        = computePct(driver);
  const hasDocs    = hasPerDocData(driver);
  const nextAction = pick(driver, 'nextAction', 'next_action');

  return (
    <TR onClick={onClick}>
      <TD>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-accent-navy text-brand-400 font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-brand-500/40">
            {name[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-ink font-medium text-sm truncate max-w-[220px]">{name}</p>
            <p className="text-ink-muted text-[11px] truncate">
              {phone}{goId ? ` · ${goId}` : ''}
            </p>
          </div>
        </div>
      </TD>
      <TD>
        <Badge tone={meta.tone} icon={Icon}>{meta.label}</Badge>
      </TD>
      <TD>
        {hasDocs ? <DocStatusStrip driver={driver} /> : <span className="text-[11px] text-ink-faint">—</span>}
      </TD>
      <TD className="min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-brand-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent-navy rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-ink font-semibold tabular-nums w-10 text-right">{pct}%</span>
        </div>
        <p className="text-[10px] text-ink-faint mt-0.5">{verified}/{TOTAL_DOCS} verified</p>
      </TD>
      <TD className="max-w-[220px]">
        {nextAction ? (
          <p className="text-[11px] text-ink-muted line-clamp-2 leading-snug">
            <ChevronRight size={10} className="inline -mt-0.5 mr-0.5 text-brand-700" />
            {nextAction}
          </p>
        ) : (
          <span className="text-[11px] text-ink-faint">—</span>
        )}
      </TD>
      <TD align="right">
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
        >
          Open <ChevronRight size={12} />
        </button>
      </TD>
    </TR>
  );
}

export default function MyDriversPage() {
  const nav = useNavigate();
  const [stats,       setStats]       = useState(null);
  const [drivers,     setDrivers]     = useState([]);
  const [filter,      setFilter]      = useState('');
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [dateField,   setDateField]   = useState('last_activity_at');
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState('');

  const fetchStats = useCallback(async () => {
    try { const res = await getMyStats(); setStats(res.data?.data); }
    catch { /* non-fatal */ }
  }, []);

  const fetchDrivers = useCallback(async (opts = {}) => {
    const {
      append = false, pg = 1,
      status = filter, q = search,
      from = dateFrom, to = dateTo, field = dateField,
    } = opts;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res = await getMyDrivers({
        status, search: q, page: pg, limit: 20,
        dateFrom: from || undefined,
        dateTo:   to   || undefined,
        dateField: field || undefined,
      });
      const data = res.data?.data;
      const items = data?.items || [];
      setDrivers(prev => append ? [...prev, ...items] : items);
      setHasMore(!!data?.hasMore);
      setTotal(data?.total || 0);
      setPage(data?.page || pg);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [filter, search, dateFrom, dateTo, dateField]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchDrivers({ pg: 1 }); /* eslint-disable-next-line */ }, [filter, dateFrom, dateTo, dateField]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchDrivers({ pg: 1 })]);
    setRefreshing(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">My Drivers</h2>
          <p className="text-xs text-ink-muted mt-0.5">Drivers you registered or uploaded docs for</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasModule('all_drivers') && (
            <Button variant="secondary" size="sm" icon={ListChecks} onClick={() => nav('/review-queue')}>
              <span className="hidden sm:inline">Queue</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleRefresh} loading={refreshing} icon={RefreshCw}>
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="primary" size="sm" icon={UserPlus} onClick={() => nav('/my-drivers/new')}>
            New Driver
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        <StatCard label="Total"    value={stats?.totalDrivers}  icon={Users} />
        <StatCard label="Verified" value={stats?.verified}      icon={CheckCircle2} />
        <StatCard label="Review"   value={stats?.pendingReview} icon={AlertTriangle} />
        <StatCard label="In Prog." value={stats?.inProgress}    icon={Clock} />
        <StatCard label="Rejected" value={stats?.rejected}      icon={XCircle} />
        <StatCard label="Suspend"  value={stats?.suspended}     icon={Ban} />
        <StatCard label="New"      value={stats?.notStarted}    icon={CircleDashed} />
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
              Search
            </label>
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={(v) => fetchDrivers({ q: v, pg: 1 })}
              placeholder="Phone, name, or GO ID…"
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              label="Status"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map(f => ({
                value: f.key,
                label: f.label,
                count: stats?.[f.statKey],
              }))}
              placeholder="All statuses"
            />
          </div>
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            field={dateField}
            onChange={({ from, to, field }) => {
              setDateFrom(from); setDateTo(to); setDateField(field);
            }}
          />
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      <DocStatusLegend />

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || filter ? 'No drivers match' : 'No drivers yet'}
          description={search || filter ? 'Try a different filter or search term' : 'Register your first driver to begin'}
          action={!search && !filter && (
            <Button icon={UserPlus} onClick={() => nav('/my-drivers/new')}>Register New Driver</Button>
          )}
        />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">Showing {drivers.length} of {total}</p>
          <Table>
            <THead>
              <tr>
                <TH>Driver</TH>
                <TH>Status</TH>
                <TH>Documents</TH>
                <TH>Progress</TH>
                <TH>Next Action</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {drivers.map(d => (
                <DriverTableRow
                  key={d.driverUserId || d.userId || d.user_id || d.id}
                  driver={d}
                  onClick={() => nav(`/my-drivers/${d.driverUserId || d.userId || d.user_id || d.id}`)}
                />
              ))}
            </TBody>
          </Table>

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              loading={loadingMore}
              icon={ChevronDown}
              onClick={() => fetchDrivers({ append: true, status: filter, q: search, pg: page + 1 })}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
