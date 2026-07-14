import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { getDriverActiveOtp, isOtpActionTokenConfigured } from '../../api/opsApi.js';
import { Modal, Button, Alert, Spinner } from '../ui';

function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds == null) return;
    const id = setInterval(() => {
      setLeft(prev => (prev != null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

const fmt = (s) => {
  if (s == null) return '--:--';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export default function OtpViewerModal({ userId, driverName, driverPhone, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null, missing: false });
  const [copied, setCopied] = useState(false);

  const otp   = state.data?.otp;
  const rate  = state.data?.rateLimit;
  const left  = useCountdown(otp?.remainingSeconds);

  useEffect(() => {
    let cancelled = false;
    if (!isOtpActionTokenConfigured()) {
      setState({ loading: false, data: null, error: 'X-Action-Token not configured on this client. Contact DevOps.', missing: true });
      return;
    }
    getDriverActiveOtp(userId)
      .then(res => {
        if (cancelled) return;
        setState({ loading: false, data: res.data?.data, error: null, missing: false });
      })
      .catch(err => {
        if (cancelled) return;
        const status = err.response?.status;
        const msg    = err.response?.data?.message || 'Failed to fetch OTP';
        setState({ loading: false, data: null, error: `${status ? `[${status}] ` : ''}${msg}`, missing: false });
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (otp?.remainingSeconds != null && left === 0) {
      // Auto-close on expiry
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [left, otp?.remainingSeconds, onClose]);

  const copy = async () => {
    if (!otp?.code) return;
    try {
      await navigator.clipboard.writeText(otp.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Active OTP"
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-ink-faint leading-relaxed">
            Sensitive — this view is logged. Do not share outside the driver.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-ink-muted">
          <p className="font-medium text-ink truncate">{driverName || 'Driver'}</p>
          {driverPhone && <p className="text-ink-faint">{driverPhone}</p>}
        </div>

        {state.loading && (
          <div className="py-6 flex items-center justify-center gap-2 text-ink-muted text-xs">
            <Spinner size={14} /> Fetching…
          </div>
        )}

        {state.error && (
          <Alert tone="danger" title={state.missing ? 'Configuration missing' : 'Could not fetch OTP'}>
            {state.error}
          </Alert>
        )}

        {!state.loading && !state.error && !otp && (
          <Alert tone="warning" title="No active OTP">
            Ask the driver to tap "Resend OTP" in the app, then try again.
          </Alert>
        )}

        {otp && (
          <>
            <div className="rounded-xl border border-brand-400 bg-brand-100 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-brand-800 text-[10px] uppercase tracking-widest font-semibold">
                <KeyRound size={12} /> OTP · {otp.purpose}
              </div>
              <p className="font-mono text-3xl font-bold text-ink mt-2 tracking-[0.4em]">{otp.code}</p>
              <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                <span className="text-ink-muted">Expires in</span>
                <span className={`font-mono font-semibold ${left <= 30 ? 'text-red-600' : 'text-ink'}`}>
                  {fmt(left)}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              icon={copied ? Check : Copy}
              onClick={copy}
            >
              {copied ? 'Copied' : 'Copy OTP'}
            </Button>

            {rate && (
              <p className="text-[10px] text-ink-faint text-center leading-relaxed">
                Used {rate.current}/{rate.max} in the last hour · resets in {Math.ceil((rate.windowSeconds || 3600) / 60)} min
              </p>
            )}

            <div className="flex items-start gap-2 text-[11px] text-ink-muted bg-surface-soft border border-line rounded-lg px-3 py-2">
              <ShieldAlert size={13} className="text-brand-700 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Only read the OTP to the driver over a verified phone call. Never message it.
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
