import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Users, KeyRound, UserPlus, ChevronRight,
  CheckCircle2, Clock, XCircle, Ban, CircleDashed, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { searchDrivers } from '../../api/opsApi.js';
import {
  Button, Input, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD,
} from '../../components/ui';
import OtpViewerModal from '../../components/driver/OtpViewerModal.jsx';
import DocStatusStrip from '../../components/driver/DocStatusStrip.jsx';

const STATUS_META = {
  verified:       { label: 'Verified',    tone: 'success', icon: CheckCircle2 },
  in_progress:    { label: 'In Progress', tone: 'warning', icon: Clock },
  pending_review: { label: 'Review',      tone: 'info',    icon: AlertTriangle },
  rejected:       { label: 'Rejected',    tone: 'danger',  icon: XCircle },
  suspended:      { label: 'Suspended',   tone: 'warning', icon: Ban },
  not_started:    { label: 'Not Started', tone: 'neutral', icon: CircleDashed },
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

function computeCompletion(d) {
  const explicit = pick(d, 'completionPct', 'completion_pct');
  if (explicit != null) return {
    pct: explicit,
    verified: pick(d, 'verifiedDocsCount', 'verified_docs_count') ?? 0,
    total: pick(d, 'submittedDocsCount', 'submitted_docs_count') ?? 0,
  };

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
    const done  = flags.filter(f => kyc[f]).length;
    return { pct: Math.round((done / flags.length) * 100), verified: done, total: flags.length };
  }

  const flags2 = ['aadhaar_verified', 'pan_verified', 'dl_verified', 'rc_verified', 'selfie_verified', 'bank_verified'];
  if (flags2.some(f => d[f] != null)) {
    const done = flags2.filter(f => d[f]).length;
    return { pct: Math.round((done / flags2.length) * 100), verified: done, total: flags2.length };
  }

  return { pct: 0, verified: 0, total: 0 };
}

function DriverTableRow({ driver, onOpen, onOtp }) {
  const status = pick(driver, 'overallStatus', 'overall_status') || 'not_started';
  const meta   = STATUS_META[status] || STATUS_META.not_started;
  const Icon   = meta.icon;
  const name   = pick(driver, 'fullName', 'full_name') || 'Unknown';
  const phone  = pick(driver, 'phoneNumber', 'phone_number', 'phone');
  const goId   = pick(driver, 'goId', 'go_id');
  const { pct, verified, total } = computeCompletion(driver);

  return (
    <TR onClick={onOpen}>
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
        <DocStatusStrip driver={driver} />
      </TD>
      <TD className="min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-brand-100 rounded-full overflow-hidden">
            <div className="h-full bg-accent-navy rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-ink font-semibold tabular-nums w-10 text-right">{pct}%</span>
        </div>
        {total > 0 && (
          <p className="text-[10px] text-ink-faint mt-0.5">{verified}/{total} verified</p>
        )}
      </TD>
      <TD align="right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onOtp}
            title="View active OTP"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-brand-100 border border-brand-400 text-brand-800 text-[11px] font-semibold hover:bg-brand-200 transition"
          >
            <KeyRound size={12} /> OTP
          </button>
          <button
            onClick={onOpen}
            title="Open workspace"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
          >
            Open <ChevronRight size={12} />
          </button>
        </div>
      </TD>
    </TR>
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
    const uid = pick(d, 'userId', 'driverUserId', 'user_id', 'driver_user_id', 'id');
    if (uid) nav(`/all-drivers/${uid}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
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
                    ? 'bg-accent-navy text-white border-accent-navy'
                    : 'bg-surface-soft text-ink-muted border-line hover:border-accent-navy hover:text-accent-navy'}`}
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
          <p className="text-ink-muted text-xs px-1">Showing {drivers.length}{total ? ` of ${total}` : ''}</p>
          <Table>
            <THead>
              <tr>
                <TH>Driver</TH>
                <TH>Status</TH>
                <TH>Documents</TH>
                <TH>Progress</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {drivers.map(d => {
                const uid = pick(d, 'userId', 'driverUserId', 'user_id', 'driver_user_id', 'id');
                return (
                  <DriverTableRow
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
