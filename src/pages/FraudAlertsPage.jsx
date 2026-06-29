import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, RefreshCw, ShieldAlert, ChevronRight,
} from 'lucide-react';
import { getFraudAlerts } from '../api/opsApi.js';

const SEVERITY = [
  { key: '',       label: 'All'    },
  { key: 'HIGH',   label: 'High'   },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW',    label: 'Low'    },
];

const SEV_COLOR = {
  HIGH:   'bg-red-500/20 text-red-400 border-red-500/30',
  MEDIUM: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  LOW:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const Sp = ({ size = 14 }) => <Loader2 size={size} className="animate-spin shrink-0" />;

const timeAgo = (iso) => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function FraudAlertsPage() {
  const nav = useNavigate();
  const [sev, setSev]         = useState('');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getFraudAlerts({ severity: sev || undefined });
      setItems(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load alerts');
    } finally { setLoading(false); }
  }, [sev]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <div className="border-b border-white/5 bg-[#1a1d27] px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 sticky top-0 z-20">
        <button onClick={() => nav('/')} className="p-1 text-slate-400 hover:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
          <ShieldAlert size={15} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Fraud Alerts</p>
          <p className="text-slate-400 text-[11px]">{items.length} alert{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50">
          {loading ? <Sp size={15} /> : <RefreshCw size={15} />}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
          {SEVERITY.map(s => {
            const active = sev === s.key;
            return (
              <button key={s.key || 'all'} onClick={() => setSev(s.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                  ${active
                    ? 'bg-yellow-500 text-black border-yellow-500'
                    : 'bg-[#1a1d27] text-slate-400 border-white/10 hover:text-white'}`}>
                {s.label}
              </button>
            );
          })}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs">{error}</div>}

        {loading ? (
          <div className="py-16 flex justify-center"><Sp size={24} /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-white font-medium text-sm">No alerts</p>
            <p className="text-slate-500 text-xs">Nothing flagged at this severity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(f => (
              <button key={f.id} onClick={() => f.document_id && nav(`/document/${f.document_id}`)}
                className="w-full bg-[#1a1d27] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-red-500/30 transition text-left flex items-start gap-3 group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${SEV_COLOR[f.severity] || 'bg-slate-500/15'}`}>
                  <ShieldAlert size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm">{f.flag_type}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${SEV_COLOR[f.severity] || 'bg-slate-500/15 text-slate-300 border-white/10'}`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {f.full_name || 'Unknown driver'} · {f.phone_number} · {f.document_type}
                  </p>
                  {f.details && (
                    <pre className="text-[10px] text-slate-500 mt-1 font-mono whitespace-pre-wrap break-words line-clamp-3">
                      {JSON.stringify(f.details, null, 2)}
                    </pre>
                  )}
                  <p className="text-slate-600 text-[10px] mt-1">{timeAgo(f.created_at)}</p>
                </div>
                <ChevronRight size={15} className="text-slate-600 group-hover:text-red-400 transition mt-1 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
