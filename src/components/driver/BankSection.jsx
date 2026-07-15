import React, { useState } from 'react';
import { Landmark, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge, Spinner, Alert } from '../ui';
import { verifyDriverBank } from '../../api/opsApi.js';

export default function BankSection({ userId, bankDoc, onVerified }) {
  const [acc,     setAcc]     = useState('');
  const [ifsc,    setIfsc]    = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [info,    setInfo]    = useState('');
  const [open,    setOpen]    = useState(false);

  const status      = bankDoc?.status;
  const isVerified  = status === 'auto_verified' || status === 'approved';
  const isRejected  = status === 'rejected';
  const data        = bankDoc?.extracted_data || {};

  const submit = async (e) => {
    e?.preventDefault();
    setErr(''); setInfo('');
    if (acc.trim().length < 6) return setErr('Account number is too short');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) return setErr('IFSC must be 11 chars, e.g. SBIN0001234');
    if (!name.trim()) return setErr('Name is required');
    setLoading(true);
    try {
      const res = await verifyDriverBank(userId, {
        account_number: acc.trim(),
        ifsc:           ifsc.trim().toUpperCase(),
        name:           name.trim(),
      });
      const d = res.data?.data;
      if (d?.status === 'auto_verified') {
        setAcc(''); setIfsc(''); setName('');
        onVerified?.();
      } else if (d?.status === 'manual_review') {
        setAcc(''); setIfsc(''); setName('');
        setInfo(d?.message || 'Sent for manual review — team will contact the driver within 24 hours.');
        onVerified?.();
      } else {
        const left = d?.attemptsLeft;
        setErr(
          (d?.message || 'Bank verification did not succeed') +
          (left != null ? ` · ${left} attempt${left === 1 ? '' : 's'} left` : '')
        );
      }
    } catch (e2) {
      const r = e2.response?.data;
      setErr(r?.data?.message || r?.message || 'Bank verification failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-surface-soft rounded-xl border border-line shadow-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 transition
          ${isVerified ? 'bg-green-50/60 hover:bg-green-50'
            : isRejected ? 'bg-red-50/60 hover:bg-red-50'
            : 'hover:bg-brand-100/60'}`}
      >
        <div className="w-9 h-9 rounded-lg bg-accent-navy text-brand-400 flex items-center justify-center shrink-0">
          {isVerified
            ? <CheckCircle2 size={16} className="text-accent-green" />
            : isRejected
              ? <XCircle size={16} className="text-red-500" />
              : <Landmark size={16} />}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-accent-navy text-xs sm:text-sm font-semibold">Bank Account</p>
            {isVerified && <Badge tone="success">Verified</Badge>}
            {isRejected && <Badge tone="danger">Rejected</Badge>}
            {!bankDoc   && <Badge>Not added</Badge>}
          </div>
          {isVerified && (data.bank_name || data.account_masked) && (
            <p className="text-ink-muted text-[11px] mt-0.5 truncate">
              {data.bank_name} · {data.account_masked} {data.name_match_score ? `· match ${data.name_match_score}%` : ''}
            </p>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
      </button>

      {open && (
        <div className="border-t border-line px-3 sm:px-5 py-3 sm:py-4">
          {isVerified ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 bg-surface-soft rounded-lg border border-line p-3">
              {[
                ['Bank',           data.bank_name],
                ['Branch',         data.branch],
                ['City',           data.city],
                ['IFSC',           data.ifsc],
                ['Account',        data.account_masked],
                ['Holder',         data.holder_name],
                ['Name match',     data.name_match_score != null ? `${data.name_match_score}% (${data.name_match_result || ''})` : null],
                ['Account status', data.account_status],
              ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <div key={k}>
                  <p className="text-ink-faint text-[10px] uppercase tracking-wider">{k}</p>
                  <p className="text-ink text-xs font-medium break-words leading-snug">{String(v)}</p>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5">
              {isRejected && bankDoc?.rejection_reason && (
                <Alert tone="danger">Previous attempt: {bankDoc.rejection_reason}</Alert>
              )}
              <input
                value={acc}
                onChange={e => setAcc(e.target.value.replace(/\s/g, ''))}
                placeholder="Account number"
                inputMode="numeric"
                className="w-full bg-white rounded-lg px-3 py-2.5 text-sm text-ink outline-none border border-line focus:border-brand-600"
              />
              <input
                value={ifsc}
                onChange={e => setIfsc(e.target.value.toUpperCase())}
                placeholder="IFSC (e.g. SBIN0001234)"
                maxLength={11}
                className="w-full bg-white rounded-lg px-3 py-2.5 text-sm text-ink outline-none border border-line focus:border-brand-600 uppercase"
              />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Account holder name"
                className="w-full bg-white rounded-lg px-3 py-2.5 text-sm text-ink outline-none border border-line focus:border-brand-600"
              />
              {err && <Alert tone="danger">{err}</Alert>}
              {info && <Alert tone="info">{info}</Alert>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-accent-navy text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-accent-navyMid transition disabled:opacity-60"
              >
                {loading ? <Spinner size={12} /> : <Landmark size={12} />}
                Verify Bank
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
