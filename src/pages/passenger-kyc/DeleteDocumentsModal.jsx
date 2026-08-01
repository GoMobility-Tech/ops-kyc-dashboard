import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button, Alert, Select, Input } from '../../components/ui';
import { deletePassengerDocuments } from '../../api/opsApi.js';

// `value` maps straight to the `docType` query param — '' means both.
const SCOPES = [
  { value: '',        label: 'Both documents (Aadhaar + selfie)' },
  { value: 'AADHAAR', label: 'Aadhaar — selfie goes too' },
  { value: 'SELFIE',  label: 'Selfie only' },
];

const SCOPE_NOTE = {
  '': {
    tone: 'danger',
    title: 'Everything goes',
    body: 'Both documents, every S3 image, and the extracted Aadhaar data are removed. The passenger drops back to "not started" and can upload again from scratch.',
  },
  AADHAAR: {
    tone: 'danger',
    title: 'The selfie is deleted as well',
    body: 'Face match was scored against this Aadhaar photo. Leaving the selfie behind would keep it showing as verified against a document that no longer exists — and a fresh Aadhaar upload never re-matches it. So both go.',
  },
  SELFIE: {
    tone: 'warning',
    title: 'Aadhaar stays',
    body: 'Only the selfie and its image are removed. The passenger just needs to take a new one.',
  },
};

/**
 * Hard-delete passenger documents — DB rows plus S3 objects.
 * Allowed for admin / super_admin / ops_team alike.
 * Not reversible; the audit log keeps who did it and why.
 */
export default function DeleteDocumentsModal({ userId, name, documents = [], onDone, onClose }) {
  const [scope,   setScope]   = useState('');
  const [reason,  setReason]  = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const confirmed = confirm.trim().toUpperCase() === 'DELETE';

  const hasAadhaar = documents.some(d => d.document_type === 'AADHAAR');
  const hasSelfie  = documents.some(d => d.document_type === 'SELFIE');

  // Hide scopes the passenger has nothing to delete for
  const scopes = SCOPES.filter(s =>
    s.value === ''            ? true :
    s.value === 'AADHAAR'     ? hasAadhaar :
    /* SELFIE */                hasSelfie
  );

  const note = SCOPE_NOTE[scope];

  const submit = async () => {
    if (!confirmed) return;
    setSaving(true); setError('');
    try {
      const res = await deletePassengerDocuments(userId, {
        docType: scope || undefined,
        reason:  reason.trim() || undefined,
      });
      onDone?.(res.data?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the documents');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title="Delete documents"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            loading={saving}
            disabled={!confirmed}
            onClick={submit}
          >
            Delete permanently
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-muted leading-relaxed">
          Permanently removes documents for <span className="font-semibold text-ink">{name || 'this passenger'}</span> —
          database rows and the images in S3. There is no attempt lock, so the passenger can upload again right away.
        </p>

        <Select
          label="What to delete"
          value={scope}
          onChange={setScope}
          options={scopes}
        />

        {note && (
          <Alert tone={note.tone} title={note.title}>{note.body}</Alert>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
            Reason <span className="text-ink-faint normal-case tracking-normal">(optional — saved to the audit log)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Passenger uploaded a PAN card instead of Aadhaar."
            className="w-full bg-white rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none
              placeholder:text-ink-faint focus:border-accent-navy focus:ring-2 focus:ring-brand-500/30 transition resize-y"
          />
        </div>

        <Input
          label="Type DELETE to confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && confirmed && !saving) submit(); }}
          placeholder="DELETE"
          autoFocus
          disabled={saving}
          className="uppercase tracking-wider font-semibold"
        />

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
