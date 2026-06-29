import React, { useState } from 'react';
import { Loader2, Ban } from 'lucide-react';
import { suspendDriver } from '../api/opsApi.js';

// Admin/super_admin only. Caller is responsible for role-gating the trigger.
export default function SuspendModal({ userId, driverName, onDone, onClose }) {
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const submit = async () => {
    if (!reason.trim()) return setErr('Reason is required');
    setLoading(true); setErr('');
    try {
      await suspendDriver(userId, reason.trim());
      onDone?.();
    } catch (e) {
      setErr(e.response?.data?.message || 'Suspend failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm border border-white/10 shadow-2xl">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Ban size={14} className="text-red-400" />
          </div>
          <h3 className="text-white font-semibold">Suspend driver</h3>
        </div>
        <p className="text-slate-500 text-xs mb-4 leading-relaxed">
          {driverName ? <>This will suspend <span className="text-slate-300">{driverName}</span>. </> : null}
          Driver will not be able to use the app. Action is logged.
        </p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Reason (visible to driver + audit log)..."
          className="w-full bg-[#0f1117] rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-white/10 resize-none mb-3" />
        {err && <p className="text-red-400 text-xs mb-3 leading-relaxed">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white active:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={submit} disabled={loading || !reason.trim()}
            className="flex-1 py-3 rounded-xl bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 active:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading && <Loader2 size={13} className="animate-spin" />} Confirm Suspend
          </button>
        </div>
      </div>
    </div>
  );
}
