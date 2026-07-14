import React, { useState } from 'react';
import { rejectDocument } from '../../api/opsApi.js';
import { Button, Modal, Alert } from '../ui';
import { DOC_LABELS } from './constants.js';

export default function RejectModal({ docId, docType, onDone, onClose }) {
  const [reason, setReason]    = useState('');
  const [allowRetry, setAllow] = useState(true);
  const [loading, setLoading]  = useState(false);
  const [err, setErr]          = useState('');

  const submit = async () => {
    if (!reason.trim()) return setErr('Reason is required');
    setLoading(true);
    try {
      await rejectDocument(docId, reason, allowRetry);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.message || 'Reject failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reject ${DOC_LABELS[docType] || 'Document'}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={loading} disabled={!reason.trim()} onClick={submit}>
            Confirm Reject
          </Button>
        </div>
      }
    >
      <p className="text-ink-muted text-xs mb-3 leading-relaxed">Driver will be notified with this reason.</p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        placeholder="Rejection reason (shown to driver)..."
        className="w-full bg-white rounded-lg px-3 py-2.5 text-sm text-ink outline-none border border-line focus:border-brand-600 resize-none mb-3"
      />
      <label className="flex items-center gap-2 text-sm text-ink mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allowRetry}
          onChange={e => setAllow(e.target.checked)}
          className="accent-brand-700 w-4 h-4"
        />
        Allow re-upload
      </label>
      {err && <Alert tone="danger">{err}</Alert>}
    </Modal>
  );
}
