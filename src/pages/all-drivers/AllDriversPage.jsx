import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Users, KeyRound, UserPlus, ChevronRight,
  CheckCircle2, Clock, XCircle, Ban, CircleDashed, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { searchDrivers } from '../../api/opsApi.js';
import { Button, Input, Card, Badge, EmptyState, Spinner, Alert } from '../../components/ui';
import OtpViewerModal from '../../components/driver/OtpViewerModal.jsx';

const STATUS_META = {
  verified:       { label: 'Verified',       tone: 'success', icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',    tone: 'warning', icon: Clock },
  pending_review: { label: 'Review',         tone: 'info',    icon: AlertTriangle },
  rejected:       { label: 'Rejected',       tone: 'danger',  icon: XCircle },
  suspended:      { label: 'Suspended',      tone: 'warning', icon: Ban },
  not_started:    { label: 'Not Started',    tone: 'neutral', icon: CircleDashed },
};

const FILTERS = [
  { key: '',               label: 'All' },
  { key: 'not_started',    label: 'Not Started' },
  { key: 'in_progress',    label: 'In Progress' },
  { key: 'pending_review', label: 'Review' },
  { key: 'verified',       label: 'Verified' },
  { key: 'rejected',       label: 'Rejected' },
  { key: 'suspended',      label: 'Suspended' },
];

function pick(row, ...keys) {
  for (const k of keys) if (row?.[k] != null) return row[k];
  return null;
}

const DONE_STATES = new Set(['verified', 'auto_verified', 'approved']);

// Backend list response shape varies per endpoint. Try explicit pct, then compute
// from counts, then from doc-status breakdown, then from kyc verified flags.
function computeCompletion(d) {
  const explicit = pick(d, 'completionPct', 'completion_pct');
  if (explicit != null) return { pct: explicit, verified: pick(d, 'verifiedDocsCount', 'verified_docs_count') ?? 0, total: pick(d, 'submittedDocsCount', 'submitted_docs_count') ?? 0 };

  const v = pick(d, 'verifiedDocsCount', 'verified_docs_count');
  const t = pick(d, 'submittedDocsCount', 'submitted_docs_count');
  if (t != null && t > 0 && v != null) return { pct: Math.round((v / t) * 100), verified: v, total: t };

  const breakdown = pick(d, 'docBreakdown', 'doc_breakdown');
  if (breakdown && typeof breakdown === 'object') {
    const vals = Object.values(breakdown);
    const done = vals.filter(s => DONE_STATES.has(s)).length;
    if (vals.length) return { pct: Math.round((done / vals.length) * 100), verified: done, total: vals.length };
  }

  const kyc = pick(d, 'kycStatus', 'kyc_status');
  if (kyc && typeof kyc === 'object') {
    const flags = ['aadhaarVerified', 'panVerified', 'dlVerified', 'rcVerified', 'selfieVerified', 'bankVerified'];
    const done  = flags.filter(f => kyc[f] || kyc[f.replace(/([A-Z])/g, '_$1').toLowerCase()]).length;
    return { pct: Math.round((done / flags.length) * 100), verified: done, total: flags.length };
  }

  // Direct booleans on the row (snake_case admin shape)
  const flags2 = ['aadhaar_verified', 'pan_verified', 'dl_verified', 'rc_verified', 'selfie_verified', 'bank_verified'];
  if (flags2.some(f => d[f] != null)) {
    const done = flags2.filter(f => d[f]).length;
    return { pct: Math.round((done / flags2.length) * 100), verified: done, total: flags2.length };
  }

  return { pct: 0, verified: 0, total: 0 };
}

function DriverRow({ driver, onOpen, onOtp }) {
  const status = pick(driver, 'overallStatus', 'overall_status') || 'not_started';
  const meta   = STATUS_META[status] || STATUS_META.not_started;
  const Icon   = meta.icon;
  const name   = pick(driver, 'fullName', 'full_name') || 'Unknown';
  const phone  = pick(driver, 'phoneNumber', 'phone_number', 'phone');
  const nextAction = pick(driver, 'nextAction', 'next_action');
  const { pct, verified, total } = computeCompletion(driver);

  return (
    <div className="bg-white rounded-xl border border-line hover:border-brand-500 hover:shadow-card transition">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <button
          onClick={onOpen}
          className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 font-bold text-sm flex items-center justify-center shrink-0"
        >
          {name[0].toUpperCase()}
        </button>
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-ink font-medium text-sm truncate max-w-[180px]">{name}</p>
            <Badge tone={meta.tone} icon={Icon}>{meta.label}</Badge>
          </div>
          <p className="text-ink-muted text-[11px] mt-0.5">{phone}</p>

          <div className="mt-2 h-1.5 bg-surface-alt rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px] text-ink-faint">
            <span>{pct}% complete</span>
            <span>{verified}/{total} verified</span>
          </div>

          {nextAction && (
            <p className="text-[11px] text-ink-muted mt-2 leading-snug line-clamp-2">
              <ChevronRight size={10} className="inline -mt-0.5 mr-0.5 text-brand-600" />
              {nextAction}
            </p>
          )}
        </button>
      </div>
      <div className="border-t border-line px-2 py-2 flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" icon={KeyRound} onClick={onOtp}>
          View OTP
        </Button>
        <Button variant="ghost" size="sm" icon={ChevronRight} onClick={onOpen}>
          Open
        </Button>
      </div>
    </div>
  );
}

export default function AllDriversPage() {
  const nav = useNavigate();
  const [drivers,     setDrivers]     = useState([]);
  const [filter,      setFilter]      = useState('');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');
  const [otpFor,      setOtpFor]      = useState(null);

  const fetchList = useCallback(async ({ append = false, pg = 1, status = filter, q = search } = {}) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res = await searchDrivers(q, { page: pg, limit: 20, status });
      const data = res.data?.data;
      // Backend may return either { items, hasMore, total } or a direct array
      const items = Array.isArray(data) ? data : (data?.items || data?.drivers || []);
      const nextTotal = data?.total ?? items.length;
      const nextHasMore = data?.hasMore ?? (items.length === 20);
      setDrivers(prev => append ? [...prev, ...items] : items);
      setTotal(nextTotal);
      setHasMore(nextHasMore);
      setPage(data?.page || pg);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchList({ pg: 1 }); /* eslint-disable-next-line */ }, [filter]);

  const openDriver = (d) => {
    const uid = d.userId || d.driverUserId || d.user_id || d.driver_user_id || d.id;
    if (uid) nav(`/all-drivers/${uid}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">All Drivers</h2>
          <p className="text-xs text-ink-muted mt-0.5">Full directory — open any driver, upload docs on behalf, view OTP</p>
        </div>
        <Button variant="primary" size="sm" icon={UserPlus} onClick={() => nav('/my-drivers/new')}>
          Register
        </Button>
      </div>

      <Card padding="sm" className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); fetchList({ pg: 1 }); }}>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, or GO ID… (press Enter)"
            icon={Search}
            suffix={
              search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); fetchList({ pg: 1, q: '' }); }}
                  className="text-ink-faint hover:text-ink text-base leading-none shrink-0"
                >×</button>
              )
            }
          />
        </form>
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key || 'all'}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                  ${active
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'bg-white text-ink-muted border-line hover:border-brand-500 hover:text-ink'}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No drivers found"
          description={search ? 'Try a different search term or filter' : 'The directory is empty'}
        />
      ) : (
        <>
          <p className="text-ink-faint text-xs px-1">Showing {drivers.length}{total ? ` of ${total}` : ''}</p>
          <div className="space-y-2">
            {drivers.map(d => {
              const uid = pick(d, 'userId', 'driverUserId', 'user_id', 'driver_user_id', 'id');
              return (
                <DriverRow
                  key={uid}
                  driver={d}
                  onOpen={() => openDriver(d)}
                  onOtp={() => uid && setOtpFor({
                    userId: uid,
                    name:   pick(d, 'fullName', 'full_name'),
                    phone:  pick(d, 'phoneNumber', 'phone_number', 'phone'),
                  })}
                />
              );
            })}
          </div>

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

      {otpFor && (
        <OtpViewerModal
          userId={otpFor.userId}
          driverName={otpFor.name}
          driverPhone={otpFor.phone}
          onClose={() => setOtpFor(null)}
        />
      )}
    </div>
  );
}
