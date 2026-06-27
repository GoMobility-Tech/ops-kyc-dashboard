import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LogOut, Loader2, ChevronRight, UserPlus, Users,
  CheckCircle2, AlertTriangle, Clock, XCircle, Ban, CircleDashed,
  RefreshCw, ChevronDown, Sparkles,
} from 'lucide-react';
import { getMyStats, getMyDrivers } from '../api/opsApi.js';

const STATUS_META = {
  verified:       { label: 'Verified',       color: 'bg-green-500/20 text-green-400 border-green-500/30',   icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  pending_review: { label: 'Pending Review', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       icon: AlertTriangle },
  rejected:       { label: 'Rejected',       color: 'bg-red-500/20 text-red-400 border-red-500/30',          icon: XCircle },
  suspended:      { label: 'Suspended',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Ban },
  not_started:    { label: 'Not Started',    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',    icon: CircleDashed },
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

const Sp = ({ size = 14 }) => <Loader2 size={size} className="animate-spin shrink-0" />;

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className={`bg-[#1a1d27] rounded-xl border border-white/5 p-3 sm:p-4 ${accent}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider truncate">{label}</span>
        {Icon && <Icon size={14} className="text-slate-600 shrink-0" />}
      </div>
      <p className="text-white font-bold text-lg sm:text-2xl">{value ?? '—'}</p>
    </div>
  );
}

function DriverCard({ driver, onClick }) {
  const meta = STATUS_META[driver.overallStatus] || STATUS_META.not_started;
  const Icon = meta.icon;
  const pct  = driver.completionPct ?? 0;

  return (
    <button onClick={onClick}
      className="w-full bg-[#1a1d27] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-yellow-500/30 active:border-yellow-500/50 transition text-left group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
          <span className="text-yellow-400 font-bold text-sm">
            {(driver.fullName || 'D')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white font-medium text-sm truncate max-w-[180px]">
              {driver.fullName || 'Unknown'}
            </p>
            {driver.registeredByMe && (
              <span title="Registered by you" className="text-yellow-400">
                <Sparkles size={11} />
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${meta.color}`}>
              <Icon size={9} /> {meta.label}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5">{driver.phoneNumber}</p>

          {/* Progress */}
          <div className="mt-2 h-1 bg-[#0f1117] rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
            <span>{pct}% complete</span>
            <span>{driver.verifiedDocsCount ?? 0}/{driver.submittedDocsCount ?? 0} verified</span>
          </div>

          {driver.nextAction && (
            <p className="text-[11px] text-slate-400 mt-2 leading-snug line-clamp-2">
              <ChevronRight size={10} className="inline -mt-0.5 mr-0.5 text-yellow-400" />
              {driver.nextAction}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-slate-600 group-hover:text-yellow-400 transition mt-1 shrink-0" />
      </div>
    </button>
  );
}

export default function MyWorkspacePage() {
  const nav = useNavigate();
  const [stats,      setStats]      = useState(null);
  const [drivers,    setDrivers]    = useState([]);
  const [filter,     setFilter]     = useState('');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const searchDebounce = useRef(null);

  const fetchStats = useCallback(async () => {
    try { const res = await getMyStats(); setStats(res.data?.data); }
    catch { /* non-fatal */ }
  }, []);

  const fetchDrivers = useCallback(async (opts = {}) => {
    const { append = false, status = filter, q = search, pg = 1 } = opts;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res = await getMyDrivers({ status, search: q, page: pg, limit: 20 });
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
  }, [filter, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Refetch on filter change
  useEffect(() => { fetchDrivers({ status: filter, q: search, pg: 1 }); /* eslint-disable-next-line */ }, [filter]);

  // Debounced search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchDrivers({ status: filter, q: search, pg: 1 });
    }, 350);
    return () => clearTimeout(searchDebounce.current);
    // eslint-disable-next-line
  }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchDrivers({ status: filter, q: search, pg: 1 })]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('ops_token');
    nav('/login');
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#1a1d27] px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src="/logo.jpeg" alt="GO Mobility" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">My Workspace</p>
            <p className="text-slate-400 text-xs hidden sm:block">Ops KYC Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
            title="Refresh">
            {refreshing ? <Sp size={15} /> : <RefreshCw size={15} />}
          </button>
          <button onClick={() => nav('/driver/new')}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-yellow-500 text-black text-xs sm:text-sm font-bold hover:bg-yellow-400 transition">
            <UserPlus size={14} />
            <span className="hidden sm:inline">New Driver</span>
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs sm:text-sm transition px-2">
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          <StatCard label="Total"    value={stats?.totalDrivers}  icon={Users}          />
          <StatCard label="Verified" value={stats?.verified}      icon={CheckCircle2}   accent="border-green-500/20" />
          <StatCard label="Review"   value={stats?.pendingReview} icon={AlertTriangle}  accent="border-blue-500/20" />
          <StatCard label="In Prog." value={stats?.inProgress}    icon={Clock}          accent="border-yellow-500/20" />
          <StatCard label="Rejected" value={stats?.rejected}      icon={XCircle}        accent="border-red-500/20" />
          <StatCard label="Suspend"  value={stats?.suspended}     icon={Ban}            accent="border-orange-500/20" />
          <StatCard label="New"      value={stats?.notStarted}    icon={CircleDashed}   />
        </div>

        {/* Search + filter */}
        <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-3 sm:p-4 space-y-3 sticky top-[57px] sm:top-[65px] z-10">
          <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-yellow-500/30 transition">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone or name..."
              className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-slate-600 min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white text-lg leading-none">×</button>
            )}
          </div>

          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
            {FILTERS.map(f => {
              const count = stats?.[f.statKey];
              const active = filter === f.key;
              return (
                <button key={f.key || 'all'} onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                    ${active
                      ? 'bg-yellow-500 text-black border-yellow-500'
                      : 'bg-[#0f1117] text-slate-400 border-white/10 hover:text-white hover:border-white/20'}`}>
                  {f.label}{count != null ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Driver list */}
        {loading ? (
          <div className="py-16 flex justify-center"><Sp size={24} /></div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-12 sm:py-16 space-y-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <Users size={22} className="text-slate-600" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">
                {search || filter ? 'No drivers match' : 'No drivers yet'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {search || filter ? 'Try a different filter or search term' : 'Register your first driver'}
              </p>
            </div>
            {!search && !filter && (
              <button onClick={() => nav('/driver/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 transition">
                <UserPlus size={14} /> Register New Driver
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-xs px-1">
              Showing {drivers.length} of {total}
            </p>
            <div className="space-y-2">
              {drivers.map(d => (
                <DriverCard key={d.driverUserId} driver={d}
                  onClick={() => nav(`/driver/${d.driverUserId}`)} />
              ))}
            </div>

            {hasMore && (
              <button onClick={() => fetchDrivers({ append: true, status: filter, q: search, pg: page + 1 })}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:border-white/20 hover:text-white transition flex items-center justify-center gap-2 disabled:opacity-50">
                {loadingMore ? <Sp size={14} /> : <ChevronDown size={14} />}
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
