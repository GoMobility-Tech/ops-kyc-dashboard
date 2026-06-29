import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, ThumbsUp, ThumbsDown, AlertTriangle, Download,
  Phone, ExternalLink, ChevronDown, ChevronUp, ShieldAlert, FileText,
  CheckCircle2, XCircle, Ban,
} from 'lucide-react';
import {
  getDocumentDetail, getFraudAlerts,
  approveDocument, rejectDocument,
} from '../api/opsApi.js';
import { isAdmin } from '../utils/auth.js';
import SuspendModal from './SuspendModal.jsx';

const DOC_LABELS = {
  AADHAAR:         'Aadhaar Card',
  PAN:             'PAN Card',
  DRIVING_LICENCE: 'Driving Licence',
  VEHICLE_RC:      'Vehicle RC',
  SELFIE:          'Selfie',
  BANK_ACCOUNT:    'Bank Account',
};

// Per-doc-type field schema — drives the "Extracted data" section
const FIELDS = {
  AADHAAR: [
    ['name',       'Name'],
    ['dob',        'Date of Birth'],
    ['gender',     'Gender'],
    ['state',      'State'],
    ['district',   'District'],
    ['pin_code',   'PIN'],
    ['masked',     'Aadhaar (masked)'],
    ['address',    'Address'],
  ],
  PAN: [
    ['name',           'Name'],
    ['father',         "Father's Name"],
    ['dob',            'Date of Birth'],
    ['masked',         'PAN (masked)'],
    ['govt_verified',  'Govt Verified'],
    ['pan_status',     'PAN Status'],
    ['name_match',     'Name Match %'],
    ['dob_match',      'DOB Match %'],
    ['aadhaar_linked', 'Aadhaar Linked'],
  ],
  DRIVING_LICENCE: [
    ['name',              'Name'],
    ['guardian',          'Guardian'],
    ['dob',               'Date of Birth'],
    ['blood_group',       'Blood Group'],
    ['issuing_authority', 'Issuing Authority'],
    ['issue_date',        'Issue Date'],
    ['expiry_date',       'Expiry Date'],
    ['address',           'Address'],
    ['pin_code',          'PIN'],
    ['govt_verified',     'Govt Verified'],
    ['dl_status',         'DL Status'],
    ['masked',            'DL (masked)'],
  ],
  VEHICLE_RC: [
    ['owner',                  'Owner'],
    ['vehicle_model',          'Model'],
    ['manufacturer',           'Manufacturer'],
    ['manufacturing_date',     'Manufacturing'],
    ['registration_date',      'Registration'],
    ['registration_validity',  'Registration Valid Till'],
    ['chassis',                'Chassis'],
    ['engine',                 'Engine'],
    ['insurance_status',       'Insurance'],
    ['insurance_expiry',       'Insurance Expiry'],
    ['pucc_status',            'PUCC'],
    ['pucc_expiry',            'PUCC Expiry'],
    ['fitness_expiry',         'Fitness Expiry'],
    ['permit_expiry',          'Permit Expiry'],
    ['plate_color',            'Plate Color'],
    ['commercial',             'Commercial'],
  ],
  SELFIE: [
    ['similarity_score', 'Similarity vs Aadhaar'],
    ['aadhaar_doc_id',   'Matched Aadhaar Doc ID'],
  ],
  BANK_ACCOUNT: [
    ['bank_name',         'Bank'],
    ['branch',            'Branch'],
    ['ifsc',              'IFSC'],
    ['account_masked',    'Account'],
    ['holder_name',       'Holder'],
    ['name_match_score',  'Name Match %'],
    ['account_status',    'Status'],
  ],
};

const PRESET_REASONS = [
  'Image blurry / unclear',
  'Wrong document type uploaded',
  'Document expired',
  'Govt verification failed',
  'Number does not match across documents',
  'Other (specify)',
];

const Sp = ({ size = 14 }) => <Loader2 size={size} className="animate-spin shrink-0" />;

const Field = ({ label, value }) => {
  if (value == null || value === '') return null;
  return (
    <div>
      <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-slate-200 text-xs font-medium break-words leading-snug">
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
      </p>
    </div>
  );
};

const Chip = ({ label, color = 'bg-slate-500/20 text-slate-400 border-slate-500/30' }) => (
  <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${color}`}>
    {label}
  </span>
);

function NumberMismatchAlert({ provided, extracted, attempts }) {
  // character-level diff
  const len = Math.max(provided?.length || 0, extracted?.length || 0);
  const cells = [];
  for (let i = 0; i < len; i++) {
    const p = provided?.[i] ?? '·';
    const e = extracted?.[i] ?? '·';
    cells.push({ p, e, diff: p !== e });
  }
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-400 shrink-0" />
        <p className="text-red-400 font-semibold text-sm">Number mismatch</p>
        <Chip label={`${attempts ?? 3}/3 attempts`} color="bg-red-500/20 text-red-400 border-red-500/30" />
      </div>
      <div className="font-mono text-xs space-y-1.5">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Driver typed</p>
          <div className="flex flex-wrap gap-px">
            {cells.map((c, i) => (
              <span key={i} className={`px-1 py-0.5 rounded ${c.diff ? 'bg-red-500/30 text-red-200' : 'bg-white/5 text-slate-300'}`}>
                {c.p}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">OCR extracted</p>
          <div className="flex flex-wrap gap-px">
            {cells.map((c, i) => (
              <span key={i} className={`px-1 py-0.5 rounded ${c.diff ? 'bg-red-500/30 text-red-200' : 'bg-white/5 text-slate-300'}`}>
                {c.e}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-red-400/70 text-[11px] leading-relaxed">
        Likely cause: driver typo OR image too unclear. Cross-verify with driver via call before deciding.
      </p>
    </div>
  );
}

function ImageViewer({ url, label }) {
  const [rot, setRot] = useState(0);
  if (!url) return null;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
        <p className="text-slate-400 text-xs font-medium">{label}</p>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <button onClick={() => setRot(r => (r + 90) % 360)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5">
              Rotate
            </button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1">
            <ExternalLink size={11} /> Open
          </a>
          <a href={url} download
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1">
            <Download size={11} />
          </a>
        </div>
      </div>
      <div className="bg-[#0f1117] flex items-center justify-center p-2 min-h-[200px]">
        {isPdf ? (
          <div className="text-slate-400 flex flex-col items-center gap-1 py-8">
            <FileText size={28} />
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-yellow-400 text-xs underline">Open PDF</a>
          </div>
        ) : (
          <img src={url} alt={label} className="max-h-[420px] object-contain transition-transform"
            style={{ transform: `rotate(${rot}deg)` }} />
        )}
      </div>
    </div>
  );
}

function RawOcrBlock({ payload }) {
  const [open, setOpen] = useState(false);
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) return null;
  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-white/5">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition">
        <span className="text-slate-300 text-xs font-medium flex items-center gap-1.5">
          <FileText size={12} /> Raw OCR payload (debug)
        </span>
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>
      {open && (
        <pre className="text-[10px] text-slate-400 bg-[#0f1117] m-3 p-3 rounded-xl overflow-x-auto max-h-80 font-mono whitespace-pre-wrap break-words">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function RejectDialog({ docId, onDone, onClose }) {
  const [preset, setPreset]      = useState(PRESET_REASONS[0]);
  const [custom, setCustom]      = useState('');
  const [allowRetry, setAllow]   = useState(true);
  const [loading, setLoading]    = useState(false);
  const [err, setErr]            = useState('');

  const submit = async () => {
    const reason = preset === 'Other (specify)' ? custom.trim() : preset;
    if (!reason) return setErr('Reason is required');
    setLoading(true); setErr('');
    try { await rejectDocument(docId, reason, allowRetry); onDone(); }
    catch (e) { setErr(e.response?.data?.message || 'Reject failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border border-white/10 shadow-2xl">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="text-white font-semibold mb-1">Reject document</h3>
        <p className="text-slate-500 text-xs mb-4">Driver will be notified with this reason.</p>

        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Reason</p>
        <select value={preset} onChange={e => setPreset(e.target.value)}
          className="w-full bg-[#0f1117] rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-white/10 mb-3">
          {PRESET_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {preset === 'Other (specify)' && (
          <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={3}
            placeholder="Custom reason..."
            className="w-full bg-[#0f1117] rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-white/10 resize-none mb-3" />
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300 mb-5 cursor-pointer select-none">
          <input type="checkbox" checked={allowRetry} onChange={e => setAllow(e.target.checked)} className="accent-yellow-500 w-4 h-4" />
          Allow driver to re-upload
        </label>

        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white active:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading && <Sp size={13} />} Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [doc, setDoc]         = useState(null);
  const [flags, setFlags]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [actionErr, setAErr]  = useState('');
  const [approving, setApp]   = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);

  const admin = isAdmin();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getDocumentDetail(id);
      const d = res.data?.data;
      setDoc(d);

      // Fetch fraud alerts & filter to this doc
      try {
        const fRes = await getFraudAlerts();
        const all = fRes.data?.data || [];
        setFlags(all.filter(f => f.document_id === d?.id));
      } catch { /* non-fatal */ }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load document');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    setApp(true); setAErr('');
    try {
      await approveDocument(doc.id, 'Verified manually — image clear, govt records match');
      await load();
    } catch (e) {
      // Backend returns specific hard-restriction messages: AGE_UNDER_18, DUPLICATE_DOC, DOC_TAMPERED, PAN_INACTIVE, DL_NOT_ACTIVE, RC_EXPIRED
      setAErr(e.response?.data?.message || 'Approve blocked by backend');
    } finally { setApp(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Sp size={28} />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-4">
        <XCircle size={32} className="text-red-400 mb-3" />
        <p className="text-white text-sm font-medium">{error || 'Document not found'}</p>
        <button onClick={() => nav(-1)} className="mt-4 text-yellow-400 text-sm underline">Go back</button>
      </div>
    );
  }

  const ext = doc.extracted_data || {};
  const fields = FIELDS[doc.document_type] || [];
  const isMismatch = (doc.rejection_reason || '').startsWith('NUMBER_MISMATCH');

  // OCR full number for the diff: try common shapes
  const ocrFull =
    ext.cashfree_ocr?.document_fields?.aadhaar_number ||
    ext.cashfree_ocr?.document_fields?.pan_number ||
    ext.cashfree_ocr?.document_fields?.dl_number ||
    ext.cashfree_ocr?.document_fields?.reg_no ||
    ext.full_number ||
    null;

  const statusColor = {
    auto_verified:  'bg-green-500/20 text-green-400 border-green-500/30',
    approved:       'bg-green-500/20 text-green-400 border-green-500/30',
    manual_review:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    rejected:       'bg-red-500/20 text-red-400 border-red-500/30',
    pending:        'bg-slate-500/20 text-slate-400 border-slate-500/30',
    processing:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }[doc.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';

  const isTerminal = doc.status === 'auto_verified' || doc.status === 'approved' || doc.status === 'rejected';

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#1a1d27] px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 sticky top-0 z-20">
        <button onClick={() => nav(-1)} className="p-1 text-slate-400 hover:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm">{DOC_LABELS[doc.document_type] || doc.document_type}</p>
            <Chip label={(doc.status || '').replace(/_/g, ' ')} color={statusColor} />
            {isMismatch && (
              <Chip label="ATTENTION" color="bg-red-500/20 text-red-400 border-red-500/30" />
            )}
          </div>
          <p className="text-slate-400 text-[11px]">#{doc.id} · {doc.method || 'OCR'}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* LEFT: Images */}
        <div className="space-y-3">
          <ImageViewer url={doc.file_url}      label="Front" />
          <ImageViewer url={doc.back_file_url} label="Back"  />
          {ext.photo_url && <ImageViewer url={ext.photo_url} label="Photo (from doc)" />}
        </div>

        {/* RIGHT: Data + actions */}
        <div className="space-y-3">
          {/* Driver header */}
          <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">{doc.full_name || 'Unknown'}</p>
                <p className="text-slate-500 text-[11px]">{doc.phone_number}{doc.email ? ` · ${doc.email}` : ''}</p>
              </div>
              <a href={`tel:${doc.phone_number}`}
                className="px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition flex items-center gap-1.5">
                <Phone size={12} /> Call
              </a>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => nav(`/driver/${doc.user_id}`)}
                className="text-yellow-400 text-xs hover:underline">
                Open driver →
              </button>
              {doc.driver_overall_status && (
                <Chip label={doc.driver_overall_status.replace(/_/g, ' ')} />
              )}
              {admin && (
                <button onClick={() => setShowSuspend(true)}
                  className="ml-auto px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-semibold hover:bg-red-500/20 transition flex items-center gap-1">
                  <Ban size={11} /> Suspend
                </button>
              )}
            </div>
          </div>

          {/* Number mismatch alert */}
          {isMismatch && (
            <NumberMismatchAlert
              provided={doc.provided_number}
              extracted={ocrFull || doc.document_number}
              attempts={doc.attempt_count}
            />
          )}

          {/* Extracted data */}
          {fields.length > 0 && (
            <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-4">
              <p className="text-slate-300 text-xs font-semibold mb-3 uppercase tracking-wider">Extracted data</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {fields.map(([k, label]) => <Field key={k} label={label} value={ext[k]} />)}
              </div>
            </div>
          )}

          {/* Scores */}
          <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Confidence</p>
              <p className="text-white font-bold text-lg">
                {doc.confidence_score != null ? `${Math.round(doc.confidence_score * 100)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Fraud</p>
              <p className={`font-bold text-lg ${doc.fraud_score > 0 ? 'text-red-400' : 'text-white'}`}>
                {doc.fraud_score ?? 0}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Attempts</p>
              <p className="text-white font-bold text-lg">{doc.attempt_count ?? 0}/3</p>
            </div>
          </div>

          {/* Fraud flags */}
          {flags.length > 0 && (
            <div className="bg-[#1a1d27] rounded-2xl border border-red-500/20 p-4 space-y-2">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={12} /> Fraud flags ({flags.length})
              </p>
              {flags.map(f => (
                <div key={f.id} className="bg-[#0f1117] rounded-xl p-3 border border-red-500/15">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-xs font-semibold">{f.flag_type}</span>
                    <Chip label={f.severity}
                      color={f.severity === 'HIGH'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : f.severity === 'MEDIUM'
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'} />
                  </div>
                  {f.details && (
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(f.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Raw OCR */}
          <RawOcrBlock payload={doc.ocr_raw_payload || ext.cashfree_ocr} />

          {/* Action errors */}
          {actionErr && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs flex items-start gap-2">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{actionErr}</span>
            </div>
          )}

          {/* Actions */}
          {!isTerminal && (
            <div className="flex gap-2 sticky bottom-3">
              <button onClick={handleApprove} disabled={approving}
                className="flex-1 py-3 rounded-xl bg-green-500/90 text-white text-sm font-semibold hover:bg-green-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                {approving ? <Sp size={13} /> : <ThumbsUp size={13} />} Approve
              </button>
              <button onClick={() => setShowReject(true)}
                className="flex-1 py-3 rounded-xl bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 transition flex items-center justify-center gap-1.5">
                <ThumbsDown size={13} /> Reject
              </button>
            </div>
          )}

          {isTerminal && (
            <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-4 flex items-center gap-2">
              {doc.status === 'rejected'
                ? <XCircle size={16} className="text-red-400" />
                : <CheckCircle2 size={16} className="text-green-400" />}
              <p className="text-slate-300 text-xs">
                Already {doc.status.replace(/_/g, ' ')}
                {doc.reviewed_by_name ? ` by ${doc.reviewed_by_name}` : ''}
                {doc.verified_at ? ` · ${new Date(doc.verified_at).toLocaleString()}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {showReject && (
        <RejectDialog docId={doc.id}
          onDone={() => { setShowReject(false); load(); }}
          onClose={() => setShowReject(false)} />
      )}

      {showSuspend && (
        <SuspendModal userId={doc.user_id} driverName={doc.full_name}
          onDone={() => { setShowSuspend(false); load(); }}
          onClose={() => setShowSuspend(false)} />
      )}
    </div>
  );
}
