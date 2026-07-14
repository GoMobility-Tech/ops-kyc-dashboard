import React from 'react';
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Flame,
  RefreshCw, RotateCcw, Upload, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Badge, Spinner } from '../ui';
import DocThumb from './DocThumb.jsx';
import ExtractedDataPanel from './ExtractedDataPanel.jsx';
import { DOC_LABELS } from './constants.js';

export default function BatchJobRow({
  docType, job, existingDoc, approving,
  onApprove, onReject, onRetry, onReupload,
}) {
  const jobStatus       = job?.jobStatus;
  const resultDocStatus = job?.resultDocStatus;
  const doc             = job?.doc || {};
  const docId           = existingDoc?.id || job?.documentId;
  const isApproving     = approving === docId;
  const frontUrl        = doc.fileUrl      || existingDoc?.file_url;
  const backUrl         = doc.backFileUrl  || existingDoc?.back_file_url;

  if (!job) {
    const exStatus = existingDoc?.status;
    const tone = (exStatus === 'auto_verified' || exStatus === 'approved') ? 'success' : 'neutral';
    return (
      <div className="px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 opacity-60">
        <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
          {(exStatus === 'auto_verified' || exStatus === 'approved')
            ? <CheckCircle2 size={14} className="text-accent-green" />
            : <div className="w-3 h-3 rounded-full border-2 border-line" />}
        </div>
        <p className="text-ink-muted text-xs sm:text-sm font-medium flex-1 min-w-0 truncate">{DOC_LABELS[docType]}</p>
        <Badge tone={tone}>{exStatus ? exStatus.replace(/_/g, ' ') : 'not uploaded'}</Badge>
      </div>
    );
  }

  let iconEl, chip, actionType = null;

  const lastErr      = job?.lastError || '';
  const docReject    = doc.rejectionReason || existingDoc?.rejection_reason || '';
  const isSoftMis    = /NUMBER_MISMATCH$/.test(lastErr) || /NUMBER_MISMATCH$/.test(docReject);
  const isHardMis    = /NUMBER_MISMATCH_MAX_ATTEMPTS/.test(lastErr) || /NUMBER_MISMATCH_MAX_ATTEMPTS/.test(docReject);

  if (jobStatus === 'queued') {
    iconEl = <Clock size={14} className="text-ink-muted" />;
    chip   = <Badge>Queued</Badge>;
  } else if (jobStatus === 'processing') {
    iconEl = <Spinner size={14} />;
    chip   = <Badge tone="info">Verifying...</Badge>;
  } else if (jobStatus === 'failed') {
    iconEl = <Flame size={14} className="text-orange-600" />;
    chip   = <Badge tone="warning">Infra Error</Badge>;
    actionType = 'failed';
  } else if (jobStatus === 'succeeded') {
    if (resultDocStatus === 'auto_verified' || resultDocStatus === 'approved') {
      iconEl = <CheckCircle2 size={14} className="text-accent-green" />;
      chip   = <Badge tone="success">{resultDocStatus === 'approved' ? 'Approved' : 'Verified'}</Badge>;
      actionType = 'verified';
    } else if (resultDocStatus === 'pending') {
      iconEl = <RefreshCw size={14} className="text-blue-600" />;
      chip   = <Badge tone="info">Soft retry — re-stage</Badge>;
      actionType = 'soft_retry';
    } else if (resultDocStatus === 'manual_review') {
      iconEl = <AlertTriangle size={14} className="text-amber-600" />;
      chip   = <Badge tone="warning">{isHardMis ? 'Mismatch — review' : 'Needs review'}</Badge>;
      actionType = 'review';
    } else if (resultDocStatus === 'rejected') {
      iconEl = <XCircle size={14} className="text-red-600" />;
      chip   = <Badge tone="danger">Rejected</Badge>;
      actionType = 'rejected';
    } else {
      iconEl = <CheckCircle2 size={14} className="text-ink-muted" />;
      chip   = <Badge>{resultDocStatus || 'Done'}</Badge>;
    }
  }

  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center shrink-0">{iconEl}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className="text-ink text-xs sm:text-sm font-medium">{DOC_LABELS[docType]}</p>
            {chip}
            {actionType === 'verified' && doc.confidenceScore != null && (
              <span className="text-ink-faint text-[11px]">{doc.confidenceScore}%</span>
            )}
          </div>
        </div>
      </div>

      {(frontUrl || backUrl) && (
        <div className="ml-10 sm:ml-11 flex gap-2">
          {frontUrl && <DocThumb url={frontUrl} label="Front" />}
          {backUrl  && <DocThumb url={backUrl}  label="Back"  />}
        </div>
      )}

      {actionType === 'failed' && job?.lastError && (
        <div className="ml-10 sm:ml-11 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-800 text-[11px] font-mono leading-relaxed">
          {String(job.lastError).slice(0, 200)}
        </div>
      )}

      {actionType === 'rejected' && doc.rejectionReason && (
        <div className="ml-10 sm:ml-11 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs leading-relaxed">
          {doc.rejectionReason}
        </div>
      )}

      {actionType === 'review' && (
        <div className="ml-10 sm:ml-11 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 text-xs leading-relaxed space-y-1">
          {isHardMis ? (
            <>
              <p className="font-semibold">Number mismatch — 3 attempts used</p>
              <p>Driver-typed number doesn't match OCR. Doc gone to manual review queue.</p>
            </>
          ) : (
            <>
              <p>Manual decision required by ops review team.
                {doc.confidenceScore != null && ` Confidence ${doc.confidenceScore}%.`}</p>
              {(docReject || lastErr) && (
                <p className="text-[11px] font-mono break-words opacity-80">{docReject || lastErr}</p>
              )}
            </>
          )}
        </div>
      )}

      {actionType === 'soft_retry' && (
        <div className="ml-10 sm:ml-11 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800 text-xs leading-relaxed space-y-1.5">
          {isSoftMis ? (
            <>
              <p className="font-semibold">Number mismatch — soft retry available</p>
              <p className="opacity-80">The typed number does not match OCR. Remove this doc and re-stage with the correct number, or upload a clearer image.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">OCR / govt check failed — re-stage</p>
              <p className="opacity-80">Cashfree could not parse or verify this document. Upload a clearer image, or confirm the correct document was submitted.</p>
              {lastErr && (
                <p className="text-[11px] font-mono break-words opacity-70">{lastErr}</p>
              )}
            </>
          )}
        </div>
      )}

      {(actionType === 'verified' || actionType === 'review') && doc.extractedData && (
        <div className="ml-10 sm:ml-11">
          <ExtractedDataPanel docType={docType} data={doc.extractedData} score={doc.confidenceScore} />
        </div>
      )}

      {actionType === 'review' && (
        <div className="ml-10 sm:ml-11 flex gap-2 pt-1">
          <button
            onClick={() => onApprove(docId)}
            disabled={isApproving}
            className="flex-1 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-green-100 transition disabled:opacity-50"
          >
            {isApproving ? <Spinner size={12} /> : <ThumbsUp size={12} />} Approve
          </button>
          <button
            onClick={() => onReject(docId, docType)}
            className="flex-1 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-100 transition"
          >
            <ThumbsDown size={12} /> Reject
          </button>
        </div>
      )}

      {actionType === 'failed' && (
        <div className="ml-10 sm:ml-11 pt-1">
          <button
            onClick={() => onRetry(job.jobId)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold flex items-center justify-center sm:inline-flex gap-1.5 hover:bg-orange-100 transition"
          >
            <RotateCcw size={12} /> Retry Job
          </button>
        </div>
      )}

      {actionType === 'rejected' && (
        <div className="ml-10 sm:ml-11 pt-1">
          <button
            onClick={onReupload}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-surface-alt border border-line text-ink text-xs font-semibold flex items-center justify-center sm:inline-flex gap-1.5 hover:border-brand-500 transition"
          >
            <Upload size={12} /> Re-upload → New Batch
          </button>
        </div>
      )}

      {actionType === 'soft_retry' && (
        <div className="ml-10 sm:ml-11 pt-1">
          <button
            onClick={onReupload}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center justify-center sm:inline-flex gap-1.5 hover:bg-blue-100 transition"
          >
            <RefreshCw size={12} /> Re-stage with correct number
          </button>
        </div>
      )}
    </div>
  );
}
