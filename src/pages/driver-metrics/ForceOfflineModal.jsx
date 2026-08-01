import React, { useState } from 'react';
import { PowerOff, ShieldCheck } from 'lucide-react';
import { Modal, Button, Alert } from '../../components/ui';
import { forceDriverOffline } from '../../api/opsApi.js';
import { apiError } from './metricsMeta.js';

/**
 * Confirmation for the module's only destructive action.
 *
 * `reason` is optional on the API but mandatory here — the audit trail is the
 * whole point of routing this through ops instead of the DB.
 *
 * onDone(result) fires on any of the four outcomes so the caller can refresh
 * and toast; the modal only closes itself once the caller has been told.
 */
export default function ForceOfflineModal({ driver, onClose, onDone }) {
  const [reason, setReason]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    const r = reason.trim();
    if (!r) { setError('Reason is required'); return; }
    setBusy(true); setError('');
    try {
      const res = await forceDriverOffline(driver.driverId, r);
      onDone?.(res.data?.data || {});
      onClose?.();
    } catch (e) {
      setError(apiError(e, 'Force offline failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Force driver offline"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" icon={PowerOff} onClick={submit} loading={busy}>
            Force offline
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-surface-alt border border-line px-3 py-2">
          <p className="text-sm font-semibold text-ink">{driver.name || `Driver #${driver.driverId}`}</p>
          <p className="text-xs text-ink-muted">{driver.phone || `ID ${driver.driverId}`}</p>
        </div>

        <Alert tone="success" title="A ride in progress is never interrupted">
          If the driver is on a ride right now, this request is queued — they go offline the
          moment the ride completes. The passenger is not affected.
        </Alert>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
            rows={3}
            autoFocus
            placeholder="e.g. Customer complaint — verification pending"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink
              outline-none focus:border-accent-navy focus:ring-2 focus:ring-brand-500/30 transition
              placeholder:text-ink-faint resize-none"
          />
          <p className="text-[10px] text-ink-faint mt-1 inline-flex items-center gap-1">
            <ShieldCheck size={11} /> Recorded in the audit log.
          </p>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/**
 * Turns the four possible force-offline outcomes into a toast payload.
 * Shared so the map and the detail page never drift on wording.
 */
export const forceOfflineToast = (r = {}) => {
  if (r.applied) return { tone: 'success', text: 'Driver has been taken offline' };
  if (r.deferred) return { tone: 'warning', text: 'Driver is on a ride — they will go offline as soon as it completes.' };
  if (r.reason === 'already_offline') return { tone: 'info', text: 'Driver was already offline' };
  if (r.reason === 'state_changed_retry') return { tone: 'warning', text: 'State changed mid-request — please try again' };
  return { tone: 'info', text: 'Nothing changed' };
};
