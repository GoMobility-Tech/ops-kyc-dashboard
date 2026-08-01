import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Flag, FlagOff, ScanFace, FileText, ImageOff, Trash2,
  AlertTriangle, CheckCircle2, Copy, ExternalLink, Phone, Mail, Fingerprint,
} from 'lucide-react';
import { getPassengerKycDetail } from '../../api/opsApi.js';
import { isElevatedRole } from '../../utils/auth.js';
import {
  Card, CardHeader, Badge, Button, Alert, Spinner, EmptyState,
  JsonViewer, ImageLightbox,
} from '../../components/ui';
import FlagChips from './FlagChips.jsx';
import ClearFlagModal from './ClearFlagModal.jsx';
import DeleteDocumentsModal from './DeleteDocumentsModal.jsx';
import {
  STATUS_META, DOC_STATUS_META, flagMeta,
  FACE_MATCH_DEFAULT_THRESHOLD, fmtTime, fmtDate,
} from './passengerMeta.js';

// ── small presentational helpers ─────────────────────────────────────────────

function Field({ label, value, mono = false, tone }) {
  const empty = value == null || value === '';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</p>
      <p className={`text-xs font-medium break-words leading-snug
        ${empty ? 'text-ink-faint' : tone === 'danger' ? 'text-red-600' : 'text-ink'}
        ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

function ImageTile({ url, label, onOpen }) {
  const [failed, setFailed] = useState(false);

  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-alt h-32 flex flex-col items-center justify-center text-ink-faint gap-1">
        <ImageOff size={18} />
        <span className="text-[10px]">{label} · not uploaded</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${label} · click to zoom`}
      className="group relative block w-full h-32 rounded-lg overflow-hidden border border-line bg-surface-soft hover:border-brand-500 transition"
    >
      {failed ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-ink-muted gap-1">
          <FileText size={18} />
          <span className="text-[10px]">No preview</span>
        </div>
      ) : (
        <img
          src={url}
          alt={label}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover pointer-events-none"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-accent-navy/85 text-white text-[10px] px-1.5 py-1 text-center">
        {label}
      </div>
    </button>
  );
}

// Profile value vs the value OCR pulled off the Aadhaar, side by side.
function CompareRow({ label, profile, aadhaar, mismatch }) {
  return (
    <div className={`grid grid-cols-2 gap-3 px-3 py-2 rounded-lg border
      ${mismatch ? 'bg-amber-50 border-amber-200' : 'bg-surface-soft border-line'}`}>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label} · profile</p>
        <p className="text-xs font-medium text-ink break-words leading-snug">{profile || '—'}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label} · Aadhaar</p>
        <p className={`text-xs font-medium break-words leading-snug ${mismatch ? 'text-amber-800' : 'text-ink'}`}>
          {aadhaar || '—'}
        </p>
      </div>
    </div>
  );
}

function FaceMatchBar({ score, threshold = FACE_MATCH_DEFAULT_THRESHOLD }) {
  if (score == null) return null;
  const low = score < threshold;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ScanFace size={13} className="text-accent-navy" /> Face match
        </span>
        <span className={`text-xs font-bold tabular-nums ${low ? 'text-red-600' : 'text-green-700'}`}>
          {score} / {threshold}
        </span>
      </div>
      <div className="relative h-2 bg-brand-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${low ? 'bg-red-500' : 'bg-accent-green'}`}
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-accent-navy"
          style={{ left: `${Math.min(Math.max(threshold, 0), 100)}%` }}
          title={`Threshold ${threshold}`}
        />
      </div>
      <p className="text-[10px] text-ink-faint">
        {low
          ? 'Below threshold — compare the selfie against the Aadhaar photo yourself.'
          : 'At or above threshold.'}
      </p>
    </div>
  );
}

function DocumentCard({ doc, onOpenImage, onOpenDuplicate }) {
  const meta = DOC_STATUS_META[doc.status] || DOC_STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <Card padding="sm" className="space-y-3">
      <CardHeader
        title={doc.document_type === 'SELFIE' ? 'Selfie' : 'Aadhaar'}
        subtitle={`Doc #${doc.id} · attempt ${doc.attempt_count ?? 1} · uploaded ${fmtTime(doc.created_at)}`}
        right={<Badge tone={meta.tone} icon={Icon}>{meta.label}</Badge>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Confidence" value={doc.confidence_score != null ? `${doc.confidence_score}%` : null} />
        <Field
          label="Fraud score"
          value={doc.fraud_score != null ? `${doc.fraud_score}` : null}
          tone={doc.fraud_score != null && doc.fraud_score >= 50 ? 'danger' : undefined}
        />
        <Field label="Verified at" value={fmtTime(doc.verified_at)} />
        <Field label="Flags" value={doc.flags?.length ? `${doc.flags.length}` : '0'} />
      </div>

      {doc.flags?.length > 0 && <FlagChips flags={doc.flags} />}

      {doc.rejection_reason && (
        <Alert tone="danger" title="Failure reason">{doc.rejection_reason}</Alert>
      )}

      {doc.duplicate_of_user_id && (
        <Alert tone="danger" title="Duplicate Aadhaar">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] break-all">{doc.duplicate_of_user_id}</span>
            <button
              onClick={() => onOpenDuplicate(doc.duplicate_of_user_id)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold underline hover:no-underline"
            >
              Open that passenger <ExternalLink size={11} />
            </button>
          </div>
        </Alert>
      )}

      {(doc.file_url || doc.back_file_url) && (
        <div className="flex flex-wrap gap-2">
          {doc.file_url && (
            <button
              onClick={() => onOpenImage(doc.file_url)}
              className="text-[11px] font-semibold text-accent-navy hover:text-accent-navyMid underline"
            >
              View front image
            </button>
          )}
          {doc.back_file_url && (
            <button
              onClick={() => onOpenImage(doc.back_file_url)}
              className="text-[11px] font-semibold text-accent-navy hover:text-accent-navyMid underline"
            >
              View back image
            </button>
          )}
        </div>
      )}

      <JsonViewer label="Extracted data" data={doc.extracted_data} />
    </Card>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function PassengerDetailPage() {
  const { userId } = useParams();
  const nav = useNavigate();

  const [passenger, setPassenger] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [notice,    setNotice]    = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [delOpen,   setDelOpen]   = useState(false);
  const [lightbox,  setLightbox]  = useState(null);

  const canClearFlag = isElevatedRole();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res  = await getPassengerKycDetail(userId);
      const data = res.data?.data || {};
      setPassenger(data.passenger || null);
      setDocuments(data.documents || []);
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 404
          ? 'No passenger found for this ID.'
          : err.response?.data?.message || 'Failed to load the passenger record'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-24 flex justify-center"><Spinner size={26} /></div>;
  }

  if (error || !passenger) {
    return (
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-6 space-y-4">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav('/passenger-kyc')}>
          Back to passengers
        </Button>
        <EmptyState
          icon={AlertTriangle}
          title="Record unavailable"
          description={error || 'This passenger has no KYC record.'}
        />
      </div>
    );
  }

  const status   = passenger.status || 'not_started';
  const sMeta    = STATUS_META[status] || STATUS_META.not_started;
  const SIcon    = sMeta.icon;
  const flags    = passenger.flag_reasons || [];
  const aadhaar  = documents.find(d => d.document_type === 'AADHAAR');
  const selfie   = documents.find(d => d.document_type === 'SELFIE');
  const threshold = selfie?.extracted_data?.threshold ?? FACE_MATCH_DEFAULT_THRESHOLD;
  const addr     = passenger.address;
  const addrText = addr
    ? [addr.line, addr.district, addr.state, addr.pinCode].filter(Boolean).join(', ')
    : null;

  const images = [
    aadhaar?.file_url      && { url: aadhaar.file_url,      label: 'Aadhaar · front' },
    aadhaar?.back_file_url && { url: aadhaar.back_file_url, label: 'Aadhaar · back' },
    selfie?.file_url       && { url: selfie.file_url,       label: 'Selfie' },
  ].filter(Boolean);

  const openImage = (url) => {
    const i = images.findIndex(img => img.url === url);
    if (i >= 0) setLightbox(i);
  };

  const nameMismatch = flags.includes('NAME_MISMATCH');
  const isMinor      = flags.includes('MINOR');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav('/passenger-kyc')} className="-ml-2 mb-1">
            Passengers
          </Button>
          <h2 className="text-lg font-bold text-accent-navy truncate">{passenger.full_name || 'Unknown'}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-ink-muted">
            {passenger.phone_number && (
              <span className="inline-flex items-center gap-1"><Phone size={11} />{passenger.phone_number}</span>
            )}
            {passenger.email && (
              <span className="inline-flex items-center gap-1"><Mail size={11} />{passenger.email}</span>
            )}
            {passenger.go_id && (
              <span className="inline-flex items-center gap-1"><Fingerprint size={11} />{passenger.go_id}</span>
            )}
            <span>Joined {fmtTime(passenger.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Badge tone={sMeta.tone} icon={SIcon}>{sMeta.label}</Badge>
            {passenger.is_flagged
              ? <Badge tone="danger" icon={Flag}>Flagged</Badge>
              : <Badge tone="success" icon={CheckCircle2}>Clean</Badge>}
          </div>
          <div className="flex items-center gap-1.5">
            {documents.length > 0 && (
              <Button variant="outline" size="sm" icon={Trash2} onClick={() => setDelOpen(true)}>
                Delete docs
              </Button>
            )}
            {passenger.is_flagged && canClearFlag && (
              <Button variant="primary" size="sm" icon={FlagOff} onClick={() => setClearOpen(true)}>
                Clear flag
              </Button>
            )}
          </div>
        </div>
      </div>

      {notice && <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {passenger.is_flagged && !canClearFlag && (
        <Alert tone="info">
          Only an admin can clear flags. Review the record and pass it on if the passenger looks genuine.
        </Alert>
      )}

      {!passenger.is_flagged && passenger.flag_cleared_at && (
        <Alert tone="success" title="Flag cleared">
          {fmtTime(passenger.flag_cleared_at)}
          {passenger.flag_cleared_by_name ? ` by ${passenger.flag_cleared_by_name}` : ''}
        </Alert>
      )}

      {/* Why it's flagged */}
      {flags.length > 0 && (
        <Card padding="sm" className="space-y-3">
          <CardHeader
            title="Flags"
            subtitle="A flag never restricts the passenger — it only marks the record for review."
            right={<FlagChips flags={flags} />}
          />
          <div className="space-y-2">
            {flags.map(code => {
              const meta = flagMeta(code);
              const Icon = meta.icon;
              return (
                <div key={code} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-soft px-3 py-2">
                  {Icon && <Icon size={14} className="text-accent-navy shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">{meta.label}</p>
                    {meta.why  && <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5">{meta.why}</p>}
                    {meta.hint && <p className="text-[11px] text-brand-800 leading-relaxed mt-0.5">{meta.hint}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {status === 'not_started' ? (
        <EmptyState
          icon={FileText}
          title="KYC not started"
          description="This passenger has not uploaded any documents yet."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left — images */}
          <Card padding="sm" className="space-y-3">
            <CardHeader title="Documents" subtitle="Click any image to zoom" />
            {images.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-faint">No images on this record</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ImageTile url={aadhaar?.file_url}      label="Aadhaar front" onOpen={() => openImage(aadhaar.file_url)} />
                <ImageTile url={aadhaar?.back_file_url} label="Aadhaar back"  onOpen={() => openImage(aadhaar.back_file_url)} />
                <ImageTile url={selfie?.file_url}       label="Selfie"        onOpen={() => openImage(selfie.file_url)} />
              </div>
            )}
            {selfie && <div className="pt-1"><FaceMatchBar score={passenger.face_match_score} threshold={threshold} /></div>}
          </Card>

          {/* Right — extracted vs profile */}
          <Card padding="sm" className="space-y-3">
            <CardHeader title="Profile vs Aadhaar" subtitle="What the passenger entered against what OCR read" />
            <CompareRow
              label="Name"
              profile={passenger.full_name}
              aadhaar={passenger.name_on_aadhaar}
              mismatch={nameMismatch}
            />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field
                label={isMinor ? 'DOB on Aadhaar · under 18' : 'DOB on Aadhaar'}
                value={fmtDate(passenger.dob)}
                tone={isMinor ? 'danger' : undefined}
              />
              <Field label="Gender" value={passenger.gender} />
              <Field label="Aadhaar (last 4)" value={passenger.aadhaar_last4 ? `XXXX XXXX ${passenger.aadhaar_last4}` : null} mono />
              <Field label="Submitted" value={fmtTime(passenger.submitted_at)} />
              <Field label="Verified" value={fmtTime(passenger.verified_at)} />
              <Field label="Last activity" value={fmtTime(passenger.last_activity_at)} />
            </div>

            <Field label="Address on Aadhaar" value={addrText} />

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">User ID</span>
              <button
                onClick={() => navigator.clipboard?.writeText(passenger.id)}
                title="Copy user ID"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted hover:text-accent-navy transition break-all"
              >
                {passenger.id} <Copy size={11} className="shrink-0" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Per-document breakdown */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-accent-navy px-1">Document details</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {documents.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onOpenImage={openImage}
                onOpenDuplicate={(uid) => nav(`/passenger-kyc/${uid}`)}
              />
            ))}
          </div>
        </div>
      )}

      <ImageLightbox
        images={images}
        index={lightbox}
        onIndex={setLightbox}
        onClose={() => setLightbox(null)}
      />

      {clearOpen && (
        <ClearFlagModal
          userId={userId}
          name={passenger.full_name}
          flags={flags}
          onClose={() => setClearOpen(false)}
          onDone={() => {
            setClearOpen(false);
            setNotice('Flag cleared. Documents and KYC status are unchanged.');
            load();
          }}
        />
      )}

      {delOpen && (
        <DeleteDocumentsModal
          userId={userId}
          name={passenger.full_name}
          documents={documents}
          onClose={() => setDelOpen(false)}
          onDone={(result) => {
            setDelOpen(false);
            const gone = result?.deleted?.length ? result.deleted.join(' + ') : 'Documents';
            setNotice(
              `${gone} deleted · ${result?.s3ObjectsDeleted ?? 0} S3 object(s) removed. ` +
              `Status is now "${result?.status || 'not_started'}" — the passenger can upload again.`
            );
            load();
          }}
        />
      )}
    </div>
  );
}
