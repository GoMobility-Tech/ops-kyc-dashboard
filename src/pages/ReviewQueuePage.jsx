import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, ChevronRight, AlertTriangle, RefreshCw, Filter,
  FileText, CreditCard, Car, IdCard, User, Landmark,
} from 'lucide-react';
import { getReviewQueue } from '../api/opsApi.js';

const DOC_LABELS = {
  AADHAAR:         'Aadhaar',
  PAN:             'PAN',
  DRIVING_LICENCE: 'DL',
  VEHICLE_RC:      'RC',
  SELFIE:          'Selfie',
  BANK_ACCOUNT:    'Bank',
};

const DOC_ICONS = {
  AADHAAR:         IdCard,
  PAN:             CreditCard,
  DRIVING_LICENCE: IdCard,
  VEHICLE_RC:      Car,
  SELFIE:          User,
  BANK_ACCOUNT:    Landmark,
};

const TYPE_FILTERS = ['', 'AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'SELFIE', 'BANK_ACCOUNT'];

const STATUS_FILTERS = [
  { key: 'manual_review', label: 'Manual review' },
  { key: 'rejected',      label: 'Rejected'      },
  { key: 'all',           label: 'All'           },
];

const REJECTION_LABEL = (raw) => {
  if (!raw) return '';
  if (raw === 'NUMBER_MISMATCH')              return 'Number mismatch (soft retry)';
  if (raw === 'NUMBER_MISMATCH_MAX_ATTEMPTS') return 'Number mismatch — 3 failed attempts';
  if (/Could not extract.+number/i.test(raw)) return 'OCR failed — image quality issue';
  if (/not found or invalid in government/i.test(raw)) return 'Government records mismatch';
  if (/private vehicle/i.test(raw))           return 'White plate (non-commercial)';
  if (/insurance has expired/i.test(raw))     return 'Insurance expired';
  if (/PUCC.+expired/i.test(raw))             return 'PUCC expired';
  return raw;
};

const Sp = ({ size = 14 }) => <Loader2 size={size} className="animate-spin shrink-0" />;

const timeAgo = (iso) => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function ReviewQueuePage() {
  const nav = useNavigate();
  const [type, setType]       = useState('');
  const [status, setStatus]   = useState('manual_review');
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getReviewQueue({ type: type || undefined, status, page, limit: 20 });
      const d = res.data?.data;
      setItems(d?.items || []);
      setTotal(d?.total || 0);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load queue');
    } finally { setLoading(false); }
  }, [type, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, status]);

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <div className="border-b border-white/5 bg-[#1a1d27] px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 sticky top-0 z-20">
        <button onClick={() => nav('/')} className="p-1 text-slate-400 hover:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle size={15} className="text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Review Queue</p>
          <p className="text-slate-400 text-[11px]">{total} document{total !== 1 ? 's' : ''} waiting</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50">
          {loading ? <Sp size={15} /> : <RefreshCw size={15} />}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3">
        {/* Type filter chips */}
        <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-3 space-y-3 sticky top-[57px] sm:top-[65px] z-10">
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={10} /> Document type
            </p>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
              {TYPE_FILTERS.map(t => {
                const active = type === t;
                return (
                  <button key={t || 'all'} onClick={() => setType(t)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                      ${active
                        ? 'bg-yellow-500 text-black border-yellow-500'
                        : 'bg-[#0f1117] text-slate-400 border-white/10 hover:text-white'}`}>
                    {t ? DOC_LABELS[t] : 'All types'}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map(s => {
                const active = status === s.key;
                return (
                  <button key={s.key} onClick={() => setStatus(s.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                      ${active
                        ? 'bg-yellow-500 text-black border-yellow-500'
                        : 'bg-[#0f1117] text-slate-400 border-white/10 hover:text-white'}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs">{error}</div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center"><Sp size={24} /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-white font-medium text-sm">Queue is clear</p>
            <p className="text-slate-500 text-xs">No documents matching this filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(it => {
              const Icon = DOC_ICONS[it.document_type] || FileText;
              const isMismatchMax = it.rejection_reason === 'NUMBER_MISMATCH_MAX_ATTEMPTS';
              return (
                <button key={it.id} onClick={() => nav(`/document/${it.id}`)}
                  className={`w-full bg-[#1a1d27] rounded-xl p-3 sm:p-4 border transition text-left group flex items-start gap-3
                    ${isMismatchMax
                      ? 'border-red-500/30 hover:border-red-500/50'
                      : 'border-white/5 hover:border-yellow-500/30'}`}>
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm truncate max-w-[180px]">{it.full_name || 'Unknown'}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-slate-500/15 text-slate-300 border-white/10">
                        {DOC_LABELS[it.document_type] || it.document_type}
                      </span>
                      {isMismatchMax && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-red-500/15 text-red-400 border-red-500/30">
                          ATTENTION
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">{it.phone_number}</p>
                    {it.rejection_reason && (
                      <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 leading-snug">
                        {REJECTION_LABEL(it.rejection_reason)}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-500">
                      <span>Attempts {it.attempt_count ?? 0}/3</span>
                      <span>{timeAgo(it.updated_at || it.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-slate-600 group-hover:text-yellow-400 transition mt-1 shrink-0" />
                </button>
              );
            })}

            {/* Simple paginator */}
            {total > items.length + (page - 1) * 20 && (
              <button onClick={() => setPage(p => p + 1)} disabled={loading}
                className="w-full py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white transition">
                Next page →
              </button>
            )}
            {page > 1 && (
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-full py-2 rounded-xl text-slate-500 text-xs hover:text-white transition">
                ← Previous
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
