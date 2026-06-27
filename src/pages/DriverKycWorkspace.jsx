import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, Play, RotateCcw, CheckCircle2,
  XCircle, Clock, AlertTriangle, Flame, Loader2, Eye, ThumbsUp,
  ThumbsDown, RefreshCw, FileText, UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  getDriverKycDetail, getStagedDocuments, stageDocument,
  removeStagedDocument, triggerBatchVerification, getBatchStatus,
  retryDeadJob, approveDocument, rejectDocument,
} from '../api/opsApi.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = ['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'SELFIE'];
const DOC_LABELS = {
  AADHAAR: 'Aadhaar Card', PAN: 'PAN Card',
  DRIVING_LICENCE: 'Driving Licence', VEHICLE_RC: 'Vehicle RC', SELFIE: 'Selfie / Photo',
};
const HAS_BACK = new Set(['AADHAAR']);

const EXT = {
  AADHAAR:         { name: 'Name', dob: 'Date of Birth', gender: 'Gender', masked: 'Aadhaar (masked)', state: 'State', pin_code: 'PIN Code', district: 'District' },
  PAN:             { name: 'Name', father: "Father's Name", dob: 'Date of Birth', masked: 'PAN (masked)', govt_verified: 'Govt Verified', pan_status: 'PAN Status', name_match: 'Name Match %', aadhaar_linked: 'Aadhaar Linked' },
  DRIVING_LICENCE: { name: 'Name', dob: 'Date of Birth', masked: 'DL (masked)', blood_group: 'Blood Group', issuing_authority: 'Issuing Authority', issue_date: 'Issue Date', expiry_date: 'Expiry Date', govt_verified: 'Govt Verified' },
  VEHICLE_RC:      { owner: 'Owner', vehicle_model: 'Model', vehicle_type: 'Type', manufacturer: 'Manufacturer', insurance_status: 'Insurance', insurance_expiry: 'Insurance Expiry', fitness_expiry: 'Fitness Expiry', pucc_expiry: 'PUC Expiry', vahan_verified: 'Vahan Verified' },
  SELFIE:          { similarity_score: 'Similarity Score', aadhaar_doc_id: 'Matched Aadhaar Doc' },
};

const OVERALL_CHIP = {
  verified:       'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  not_started:    'bg-slate-500/20 text-slate-400 border-slate-500/30',
  rejected:       'bg-red-500/20 text-red-400 border-red-500/30',
  suspended:      'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

const Sp = ({ size = 14 }) => <Loader2 size={size} className="animate-spin shrink-0" />;

function Chip({ label, color = 'bg-slate-500/20 text-slate-400 border-slate-500/30' }) {
  return (
    <span className={`inline-flex items-center text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}

function ErrBanner({ msg, onClose }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-xs sm:text-sm flex items-start gap-2">
      <XCircle size={14} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{msg}</span>
      <button onClick={onClose} className="ml-1 text-red-400/50 hover:text-red-400 text-base leading-none shrink-0">×</button>
    </div>
  );
}

// ─── Extracted Data Panel ─────────────────────────────────────────────────────

function ExtractedDataPanel({ docType, data, score }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const fields = EXT[docType] || {};
  const entries = Object.entries(fields).filter(([k]) => data[k] != null && data[k] !== '');
  if (!entries.length) return null;

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition mt-1">
        <FileText size={11} />
        <span>Extracted data{score != null ? ` · ${score}%` : ''}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 bg-[#0f1117] rounded-xl p-3">
          {entries.map(([k, label]) => (
            <div key={k}>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
              <p className="text-slate-200 text-xs font-medium break-words leading-snug">{String(data[k])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({ docId, docType, onDone, onClose }) {
  const [reason, setReason]    = useState('');
  const [allowRetry, setAllow] = useState(true);
  const [loading, setLoading]  = useState(false);
  const [err, setErr]          = useState('');

  const submit = async () => {
    if (!reason.trim()) return setErr('Reason is required');
    setLoading(true);
    try { await rejectDocument(docId, reason, allowRetry); onDone(); }
    catch (e) { setErr(e.response?.data?.message || 'Reject failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Bottom sheet on mobile, centered modal on sm+ */}
      <div className="bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm border border-white/10 shadow-2xl">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="text-white font-semibold mb-1">Reject {DOC_LABELS[docType]}</h3>
        <p className="text-slate-500 text-xs mb-4 leading-relaxed">Driver will be notified with this reason.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Rejection reason (shown to driver)..."
          className="w-full bg-[#0f1117] rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-white/10 resize-none mb-3" />
        <label className="flex items-center gap-2 text-sm text-slate-300 mb-5 cursor-pointer select-none">
          <input type="checkbox" checked={allowRetry} onChange={e => setAllow(e.target.checked)} className="accent-yellow-500 w-4 h-4" />
          Allow re-upload
        </label>
        {err && <p className="text-red-400 text-xs mb-3 leading-relaxed">{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white active:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={submit} disabled={loading || !reason.trim()}
            className="flex-1 py-3 rounded-xl bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 active:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading && <Sp size={13} />} Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── File Pick Button ─────────────────────────────────────────────────────────

function FileBtn({ side, file, onChange }) {
  const ref = useRef();
  return (
    <>
      <button type="button" onClick={() => ref.current.click()}
        className={`flex-1 flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs transition active:scale-95
          ${file
            ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
            : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
        <Upload size={11} className="shrink-0" />
        <span className="truncate">
          {file ? file.name.slice(0, 14) + (file.name.length > 14 ? '…' : '') : side}
        </span>
      </button>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => onChange(e.target.files[0])} />
    </>
  );
}

// ─── Upload Phase — Doc Row ───────────────────────────────────────────────────

function DocUploadRow({ docType, existingDoc, stagedDoc, uploading, removing, onUpload, onRemove }) {
  const [front, setFront] = useState(null);
  const [back,  setBack]  = useState(null);

  const isUploading = uploading === docType;
  const isRemoving  = removing === stagedDoc?.id;
  const exStatus    = existingDoc?.status;
  const isTerminal  = exStatus === 'auto_verified' || exStatus === 'approved';
  const isProc      = exStatus === 'processing';
  const showUpload  = !stagedDoc && !isTerminal && !isProc;

  const doUpload = async () => {
    await onUpload(docType, front, back);
    setFront(null); setBack(null);
  };

  let iconEl, statusChip;
  if (stagedDoc) {
    iconEl = <Clock size={14} className="text-yellow-400" />;
    statusChip = <Chip label="Staged" color="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" />;
  } else if (isTerminal) {
    iconEl = <CheckCircle2 size={14} className="text-green-400" />;
    statusChip = <Chip label={exStatus === 'approved' ? 'Approved' : 'Verified'} color="bg-green-500/20 text-green-400 border-green-500/30" />;
  } else if (exStatus === 'rejected') {
    iconEl = <XCircle size={14} className="text-red-400" />;
    statusChip = <Chip label="Rejected" color="bg-red-500/20 text-red-400 border-red-500/30" />;
  } else if (exStatus === 'manual_review') {
    iconEl = <AlertTriangle size={14} className="text-yellow-400" />;
    statusChip = <Chip label="Manual review" color="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" />;
  } else if (isProc) {
    iconEl = <Sp size={14} />;
    statusChip = <Chip label="Processing" color="bg-blue-500/20 text-blue-400 border-blue-500/30" />;
  } else {
    iconEl = <div className="w-3 h-3 rounded-full border-2 border-slate-600" />;
    statusChip = null;
  }

  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{iconEl}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className="text-white text-xs sm:text-sm font-medium">{DOC_LABELS[docType]}</p>
            {statusChip}
          </div>
          {exStatus === 'rejected' && existingDoc?.rejection_reason && (
            <p className="text-red-400/60 text-[11px] mt-0.5 line-clamp-1">"{existingDoc.rejection_reason}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {(stagedDoc?.file_url || existingDoc?.file_url) && (
            <a href={stagedDoc?.file_url || existingDoc?.file_url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:text-white active:bg-slate-500/30 transition">
              <Eye size={13} />
            </a>
          )}
          {stagedDoc && (
            <button onClick={() => onRemove(stagedDoc.id)} disabled={isRemoving}
              className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:text-red-300 active:bg-red-500/25 transition">
              {isRemoving ? <Sp size={13} /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="ml-10 sm:ml-11 space-y-2">
          <div className="flex gap-1.5 sm:gap-2">
            <FileBtn side="Front" file={front} onChange={setFront} />
            {HAS_BACK.has(docType) && <FileBtn side="Back (rec.)" file={back} onChange={setBack} />}
          </div>
          {front && (
            <button onClick={doUpload} disabled={isUploading}
              className="w-full py-2 rounded-xl bg-yellow-500 text-black text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-yellow-400 active:bg-yellow-600 transition disabled:opacity-60">
              {isUploading ? <Sp size={12} /> : <Upload size={12} />}
              {exStatus === 'rejected' || exStatus === 'manual_review' ? 'Re-upload' : 'Upload'} {DOC_LABELS[docType]}
            </button>
          )}
        </div>
      )}

      {isProc && <p className="ml-10 sm:ml-11 text-blue-400/70 text-[11px] leading-relaxed">In a running batch — wait before re-uploading.</p>}
      {isTerminal && <p className="ml-10 sm:ml-11 text-slate-600 text-[11px]">Already verified. Reject existing doc first to re-verify.</p>}
    </div>
  );
}

// ─── Batch Phase — Job Row ────────────────────────────────────────────────────

function BatchJobRow({ docType, job, existingDoc, approving, onApprove, onReject, onRetry, onReupload }) {
  const jobStatus       = job?.jobStatus;
  const resultDocStatus = job?.resultDocStatus;
  const doc             = job?.doc || {};
  const docId           = existingDoc?.id || job?.documentId;
  const isApproving     = approving === docId;

  if (!job) {
    const exStatus = existingDoc?.status;
    const color = (exStatus === 'auto_verified' || exStatus === 'approved')
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    return (
      <div className="px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 opacity-60">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          {(exStatus === 'auto_verified' || exStatus === 'approved')
            ? <CheckCircle2 size={14} className="text-green-400" />
            : <div className="w-3 h-3 rounded-full border-2 border-slate-700" />}
        </div>
        <p className="text-slate-400 text-xs sm:text-sm font-medium flex-1 min-w-0 truncate">{DOC_LABELS[docType]}</p>
        <Chip label={exStatus ? exStatus.replace(/_/g, ' ') : 'not uploaded'} color={color} />
      </div>
    );
  }

  let iconEl, chip, actionType = null;

  if (jobStatus === 'queued') {
    iconEl = <Clock size={14} className="text-slate-400" />;
    chip   = <Chip label="Queued" />;
  } else if (jobStatus === 'processing') {
    iconEl = <Sp size={14} />;
    chip   = <Chip label="Verifying..." color="bg-blue-500/20 text-blue-400 border-blue-500/30" />;
  } else if (jobStatus === 'failed') {
    iconEl = <Flame size={14} className="text-orange-400" />;
    chip   = <Chip label="Infra Error" color="bg-orange-500/20 text-orange-400 border-orange-500/30" />;
    actionType = 'failed';
  } else if (jobStatus === 'succeeded') {
    if (resultDocStatus === 'auto_verified' || resultDocStatus === 'approved') {
      iconEl = <CheckCircle2 size={14} className="text-green-400" />;
      chip   = <Chip label={resultDocStatus === 'approved' ? 'Approved' : 'Verified'} color="bg-green-500/20 text-green-400 border-green-500/30" />;
      actionType = 'verified';
    } else if (resultDocStatus === 'manual_review') {
      iconEl = <AlertTriangle size={14} className="text-yellow-400" />;
      chip   = <Chip label="Needs review" color="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" />;
      actionType = 'review';
    } else if (resultDocStatus === 'rejected') {
      iconEl = <XCircle size={14} className="text-red-400" />;
      chip   = <Chip label="Rejected" color="bg-red-500/20 text-red-400 border-red-500/30" />;
      actionType = 'rejected';
    } else {
      iconEl = <CheckCircle2 size={14} className="text-slate-400" />;
      chip   = <Chip label={resultDocStatus || 'Done'} />;
    }
  }

  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{iconEl}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className="text-white text-xs sm:text-sm font-medium">{DOC_LABELS[docType]}</p>
            {chip}
            {actionType === 'verified' && doc.confidenceScore != null && (
              <span className="text-slate-500 text-[11px]">{doc.confidenceScore}%</span>
            )}
          </div>
        </div>
        {doc.fileUrl && (
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-slate-500/20 text-slate-400 hover:text-white transition shrink-0">
            <Eye size={13} />
          </a>
        )}
      </div>

      {actionType === 'failed' && job?.lastError && (
        <div className="ml-10 sm:ml-11 bg-orange-500/10 rounded-xl px-3 py-2 text-orange-400/80 text-[11px] font-mono leading-relaxed">
          {String(job.lastError).slice(0, 200)}
        </div>
      )}

      {actionType === 'rejected' && doc.rejectionReason && (
        <div className="ml-10 sm:ml-11 bg-red-500/10 rounded-xl px-3 py-2 text-red-400 text-xs leading-relaxed">
          {doc.rejectionReason}
        </div>
      )}

      {actionType === 'review' && (
        <div className="ml-10 sm:ml-11 bg-yellow-500/10 rounded-xl px-3 py-2 text-yellow-400/80 text-xs leading-relaxed">
          Confidence below threshold — manual decision required.
          {doc.confidenceScore != null && ` (${doc.confidenceScore}%)`}
        </div>
      )}

      {(actionType === 'verified' || actionType === 'review') && doc.extractedData && (
        <div className="ml-10 sm:ml-11">
          <ExtractedDataPanel docType={docType} data={doc.extractedData} score={doc.confidenceScore} />
        </div>
      )}

      {/* Approve / Reject */}
      {actionType === 'review' && (
        <div className="ml-10 sm:ml-11 flex gap-2 pt-1">
          <button onClick={() => onApprove(docId)} disabled={isApproving}
            className="flex-1 py-2.5 sm:py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-green-500/25 active:bg-green-500/30 transition disabled:opacity-50">
            {isApproving ? <Sp size={12} /> : <ThumbsUp size={12} />} Approve
          </button>
          <button onClick={() => onReject(docId, docType)}
            className="flex-1 py-2.5 sm:py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-500/25 active:bg-red-500/30 transition">
            <ThumbsDown size={12} /> Reject
          </button>
        </div>
      )}

      {actionType === 'failed' && (
        <div className="ml-10 sm:ml-11 pt-1">
          <button onClick={() => onRetry(job.jobId)}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold flex items-center justify-center sm:inline-flex gap-1.5 hover:bg-orange-500/25 transition">
            <RotateCcw size={12} /> Retry Job
          </button>
        </div>
      )}

      {actionType === 'rejected' && (
        <div className="ml-10 sm:ml-11 pt-1">
          <button onClick={onReupload}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-slate-500/15 border border-slate-500/30 text-slate-300 text-xs font-semibold flex items-center justify-center sm:inline-flex gap-1.5 hover:bg-slate-500/25 transition">
            <Upload size={12} /> Re-upload → New Batch
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriverKycWorkspace() {
  const { userId, batchId: urlBatchId } = useParams();
  const nav = useNavigate();

  const [driver,       setDriver]      = useState(null);
  const [staged,       setStaged]      = useState([]);
  const [batch,        setBatch]       = useState(null);
  const [uploading,    setUploading]   = useState(null);
  const [removing,     setRemoving]    = useState(null);
  const [triggering,   setTriggering]  = useState(false);
  const [approving,    setApproving]   = useState(null);
  const [rejectModal,  setRejectModal] = useState(null);
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(true);
  const [pollTimedOut, setPTO]         = useState(false);

  const pollRef   = useRef(null);
  const pollStart = useRef(null);

  const batchStatus   = batch?.status;
  const isBatchDone   = ['completed', 'partial', 'failed'].includes(batchStatus);
  const phase         = (urlBatchId || batch) ? (isBatchDone ? 'complete' : 'polling') : 'upload';
  const activeBatchId = batch?.batchId || urlBatchId;

  const allDocs   = driver?.documents || [];
  const docMap    = Object.fromEntries(allDocs.map(d => [d.document_type, d]));
  const stagedMap = Object.fromEntries(staged.map(d => [d.document_type, d]));
  const jobMap    = Object.fromEntries((batch?.jobs || []).map(j => [j.documentType, j]));

  const loadDriver = useCallback(async (skipStaged = false) => {
    try {
      const reqs = [getDriverKycDetail(userId)];
      if (!skipStaged) reqs.push(getStagedDocuments(userId));
      const [dRes, sRes] = await Promise.all(reqs);
      setDriver(dRes.data?.data);
      if (!skipStaged) setStaged(sRes?.data?.data?.documents || []);
    } catch { setError('Failed to load driver info'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadDriver(); }, [loadDriver]);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const startPoll = useCallback((bid) => {
    stopPoll();
    pollStart.current = Date.now();
    const MAX = 3 * 60 * 1000;
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStart.current > MAX) { stopPoll(); setPTO(true); return; }
      try {
        const res = await getBatchStatus(userId, bid);
        const data = res.data?.data;
        setBatch(data);
        if (['completed', 'partial', 'failed'].includes(data?.status)) { stopPoll(); loadDriver(true); }
      } catch { stopPoll(); setError('Lost connection to server — click Refresh to resume.'); }
    }, 2000);
  }, [userId, loadDriver]);

  useEffect(() => {
    if (!urlBatchId) return;
    getBatchStatus(userId, urlBatchId)
      .then(res => {
        const data = res.data?.data;
        setBatch(data);
        if (!['completed', 'partial', 'failed'].includes(data?.status)) startPoll(urlBatchId);
        else loadDriver(true);
      })
      .catch(() => setError('Failed to resume batch — try refreshing'));
    return stopPoll;
  }, []); // eslint-disable-line

  const handleUpload = async (docType, frontFile, backFile) => {
    setUploading(docType); setError('');
    const fd = new FormData();
    fd.append('document_type', docType);
    fd.append('file', frontFile);
    if (backFile) fd.append('file_back', backFile);
    try {
      await stageDocument(userId, fd);
      const sRes = await getStagedDocuments(userId);
      setStaged(sRes.data?.data?.documents || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed';
      setError(err.response?.status === 409
        ? `${msg} — Reject the existing document first to re-verify.`
        : msg);
    } finally { setUploading(null); }
  };

  const handleRemove = async (docId) => {
    setRemoving(docId); setError('');
    try {
      await removeStagedDocument(userId, docId);
      setStaged(s => s.filter(d => d.id !== docId));
    } catch (err) { setError(err.response?.data?.message || 'Remove failed'); }
    finally { setRemoving(null); }
  };

  const handleVerify = async () => {
    setTriggering(true); setError('');
    try {
      const res = await triggerBatchVerification(userId);
      const data = res.data?.data;
      setStaged([]);
      setBatch({ ...data, status: 'queued' });
      nav(`/driver/${userId}/batch/${data.batchId}`, { replace: true });
      startPoll(data.batchId);
    } catch (err) { setError(err.response?.data?.message || 'Verification trigger failed'); }
    finally { setTriggering(false); }
  };

  const handleRetry = async (jobId) => {
    try { await retryDeadJob(jobId); setPTO(false); startPoll(activeBatchId); }
    catch (err) { setError(err.response?.data?.message || 'Retry failed'); }
  };

  const handleApprove = async (docId) => {
    setApproving(docId);
    try {
      await approveDocument(docId, 'Manually approved by ops agent');
      const res = await getBatchStatus(userId, activeBatchId);
      setBatch(res.data?.data);
      loadDriver(true);
    } catch (err) { setError(err.response?.data?.message || 'Approve failed'); }
    finally { setApproving(null); }
  };

  const handleNewBatch = () => {
    stopPoll(); setBatch(null); setPTO(false);
    nav(`/driver/${userId}`, { replace: true });
    loadDriver();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Sp size={28} />
      </div>
    );
  }

  const kyc           = driver?.kycStatus || {};
  const chipColor     = OVERALL_CHIP[kyc.overall_status] || OVERALL_CHIP.not_started;
  const totalJobs     = batch?.totalJobs      ?? 0;
  const succeededJobs = batch?.succeededJobs  ?? 0;
  const failedJobs    = batch?.failedJobs     ?? 0;
  const doneJobs      = succeededJobs + failedJobs;
  const progress      = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0f1117]">

      {/* ── Header ── */}
      <div className="border-b border-white/5 bg-[#1a1d27] px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 sticky top-0 z-10">
        <button onClick={() => nav('/')} className="p-1 text-slate-400 hover:text-white active:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
          <UserCheck size={15} className="text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-xs sm:text-sm truncate">{driver?.full_name || 'Driver'}</p>
          <p className="text-slate-400 text-[11px] sm:text-xs">{driver?.phone_number}</p>
        </div>
        <Chip label={kyc.overall_status?.replace(/_/g, ' ') || 'not started'} color={chipColor} />
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-3 sm:space-y-4">
        {error && <ErrBanner msg={error} onClose={() => setError('')} />}

        {/* ══════════════════════════════════════
            SCREEN 2 — Document Upload
        ══════════════════════════════════════ */}
        {phase === 'upload' && (
          <div className="bg-[#1a1d27] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">Documents</p>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5">
                  {staged.length > 0
                    ? `${staged.length} staged — tap Verify to run KYC`
                    : 'Upload documents one by one'}
                </p>
              </div>
              {staged.length > 0 && (() => {
                const allCovered = DOC_TYPES.every(dt =>
                  stagedMap[dt] || ['auto_verified', 'approved'].includes(docMap[dt]?.status)
                );
                return (
                  <button onClick={handleVerify} disabled={triggering || !allCovered}
                    title={!allCovered ? 'Upload all documents first' : undefined}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 active:bg-yellow-600 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                    {triggering ? <Sp size={12} /> : <Play size={12} />}
                    Verify ({staged.length}/{DOC_TYPES.length - Object.values(docMap).filter(d => ['auto_verified','approved'].includes(d?.status)).length})
                  </button>
                );
              })()}
            </div>
            <div className="divide-y divide-white/5">
              {DOC_TYPES.map(dt => (
                <DocUploadRow key={dt} docType={dt}
                  existingDoc={docMap[dt]} stagedDoc={stagedMap[dt]}
                  uploading={uploading} removing={removing}
                  onUpload={handleUpload} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            SCREEN 3 + 4 — Batch Polling / Complete
        ══════════════════════════════════════ */}
        {(phase === 'polling' || phase === 'complete') && (
          <>
            {/* Batch progress card */}
            <div className="bg-[#1a1d27] rounded-2xl border border-white/5 p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm leading-tight">
                    {phase === 'polling'
                      ? `Verifying ${totalJobs} document${totalJobs !== 1 ? 's' : ''}...`
                      : batchStatus === 'completed' ? 'All documents verified!'
                      : batchStatus === 'partial'   ? 'Some documents need attention'
                      : batchStatus === 'failed'    ? 'Verification failed'
                      : 'Batch complete'}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5 truncate">
                    Batch #{(activeBatchId || '').slice(0, 8)}
                    {batch?.completedAt && ` · ${new Date(batch.completedAt).toLocaleTimeString()}`}
                  </p>
                </div>
                <div className="shrink-0">
                  {phase === 'polling' && !pollTimedOut && (
                    <span className="flex items-center gap-1 text-blue-400 text-xs"><Sp size={12} /> Live</span>
                  )}
                  {batchStatus === 'completed' && <CheckCircle2 size={20} className="text-green-400" />}
                  {batchStatus === 'partial'   && <AlertTriangle size={20} className="text-yellow-400" />}
                  {batchStatus === 'failed'    && <Flame size={20} className="text-orange-400" />}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-[#0f1117] rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: batchStatus === 'failed' ? '#ef4444' : '#eab308' }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{doneJobs}/{totalJobs} done</span>
                <span>{succeededJobs} ok · {failedJobs} failed</span>
              </div>

              {pollTimedOut && (
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-400 text-xs leading-relaxed">
                  Still running after 3 min. Background reconciler (every 2 min) will handle stuck jobs. Use Refresh below.
                </div>
              )}
            </div>

            {/* Per-doc results */}
            <div className="bg-[#1a1d27] rounded-2xl border border-white/5 overflow-hidden">
              <p className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-white/5 text-slate-400 text-[11px] font-medium uppercase tracking-wide">
                Per-Document Results
              </p>
              <div className="divide-y divide-white/5">
                {DOC_TYPES.map(dt => (
                  <BatchJobRow key={dt} docType={dt}
                    job={jobMap[dt]} existingDoc={docMap[dt]}
                    approving={approving}
                    onApprove={handleApprove}
                    onReject={(docId, type) => setRejectModal({ docId, docType: type })}
                    onRetry={handleRetry}
                    onReupload={handleNewBatch}
                  />
                ))}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex gap-2">
              {pollTimedOut && (
                <button onClick={() => { setPTO(false); startPoll(activeBatchId); }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 text-sm hover:border-white/20 hover:text-white active:bg-white/5 transition flex items-center justify-center gap-2">
                  <RefreshCw size={14} /> Refresh
                </button>
              )}
              {phase === 'complete' && (
                <button onClick={handleNewBatch}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm hover:border-white/20 hover:text-white active:bg-white/5 transition flex items-center justify-center gap-2">
                  <Upload size={14} /> New Batch
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {rejectModal && (
        <RejectModal
          docId={rejectModal.docId} docType={rejectModal.docType}
          onDone={async () => {
            setRejectModal(null);
            try { const res = await getBatchStatus(userId, activeBatchId); setBatch(res.data?.data); } catch {}
            loadDriver(true);
          }}
          onClose={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}
