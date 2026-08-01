import React, { useState } from 'react';
import { FlagOff } from 'lucide-react';
import { Modal, Button, Alert } from '../../components/ui';
import { clearPassengerFlag } from '../../api/opsApi.js';
import FlagChips from './FlagChips.jsx';

/**
 * Clear-flag confirmation. admin / super_admin only — the caller gates visibility.
 * One-way: there is no re-flag action, the passenger must re-upload to be re-evaluated.
 */
export default function ClearFlagModal({ userId, name, flags = [], onDone, onClose }) {
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const submit = async () => {
    setSaving(true); setError('');
    try {
      const res = await clearPassengerFlag(userId, notes.trim() || undefined);
      onDone?.(res.data?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not clear the flag');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title="Clear flag"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="sm" icon={FlagOff} loading={saving} onClick={submit}>
            Clear flag
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-muted leading-relaxed">
          Clearing removes the flag from <span className="font-semibold text-ink">{name || 'this passenger'}</span>.
          Documents and KYC status stay untouched, and the action is recorded in the audit log
          against your account.
        </p>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
            Flags being cleared
          </p>
          <FlagChips flags={flags} />
        </div>

        <Alert tone="warning">
          This cannot be undone from the dashboard. A flag only returns if the passenger
          uploads documents again and the system re-evaluates them.
        </Alert>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
            Notes <span className="text-ink-faint normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Called passenger — Aadhaar carries an extra middle name. Genuine."
            className="w-full bg-white rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none
              placeholder:text-ink-faint focus:border-accent-navy focus:ring-2 focus:ring-brand-500/30 transition resize-y"
          />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
