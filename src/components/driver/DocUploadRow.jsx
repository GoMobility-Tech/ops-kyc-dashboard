import React, { useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Upload, Trash2, Hash } from 'lucide-react';
import { Badge, Spinner } from '../ui';
import DocThumb from './DocThumb.jsx';
import ExtractedDataPanel from './ExtractedDataPanel.jsx';
import FileBtn from './FileBtn.jsx';
import CategoryPicker from './CategoryPicker.jsx';
import { DOC_LABELS, HAS_BACK } from './constants.js';
import { validateDocNumber, docNumberPlaceholder, docNumberHelp } from '../../utils/validateDocNumber.js';

export default function DocUploadRow({
  docType, existingDoc, stagedDoc, vehicleMaster, vmError,
  uploading, removing, onUpload, onRemove,
}) {
  const [front, setFront]           = useState(null);
  const [back,  setBack]            = useState(null);
  const [number, setNumber]         = useState('');
  const [categories, setCategories] = useState([]);

  const isUploading = uploading === docType;
  const isRemoving  = removing === stagedDoc?.id;
  const exStatus    = existingDoc?.status;
  const isTerminal  = exStatus === 'auto_verified' || exStatus === 'approved';
  const isProc      = exStatus === 'processing';
  const showUpload  = !stagedDoc && !isTerminal && !isProc;
  const wantsNumber = docType !== 'SELFIE';
  const wantsCategories = docType === 'VEHICLE_RC';

  const frontUrl = stagedDoc?.file_url      || existingDoc?.file_url;
  const backUrl  = stagedDoc?.back_file_url || existingDoc?.back_file_url;

  const v = wantsNumber ? validateDocNumber(docType, number) : { valid: true, normalized: '' };
  const numberInvalid = wantsNumber && number && !v.valid;

  const doUpload = async () => {
    if (numberInvalid) return;
    const ok = await onUpload(docType, front, back, v.normalized || '', wantsCategories ? categories : null);
    if (ok) { setFront(null); setBack(null); setNumber(''); setCategories([]); }
  };

  let iconEl, statusBadge, stripe;
  if (stagedDoc) {
    iconEl = <Clock size={14} className="text-brand-700" />;
    statusBadge = <Badge tone="brand">Staged</Badge>;
    stripe = 'border-l-4 border-brand-500 bg-brand-100/40';
  } else if (isTerminal) {
    iconEl = <CheckCircle2 size={14} className="text-accent-green" />;
    statusBadge = <Badge tone="success">{exStatus === 'approved' ? 'Approved' : 'Verified'}</Badge>;
    stripe = 'border-l-4 border-accent-green bg-green-50/40';
  } else if (exStatus === 'rejected') {
    iconEl = <XCircle size={14} className="text-red-600" />;
    statusBadge = <Badge tone="danger">Rejected</Badge>;
    stripe = 'border-l-4 border-red-500 bg-red-50/40';
  } else if (exStatus === 'manual_review') {
    iconEl = <AlertTriangle size={14} className="text-amber-600" />;
    statusBadge = <Badge tone="warning">Manual review</Badge>;
    stripe = 'border-l-4 border-amber-500 bg-amber-50/40';
  } else if (isProc) {
    iconEl = <Spinner size={14} />;
    statusBadge = <Badge tone="info">Processing</Badge>;
    stripe = 'border-l-4 border-blue-500 bg-blue-50/40';
  } else {
    iconEl = <div className="w-3 h-3 rounded-full border-2 border-line" />;
    statusBadge = null;
    stripe = 'border-l-4 border-transparent';
  }

  return (
    <div className={`px-3 sm:px-5 py-3 sm:py-4 space-y-2.5 ${stripe}`}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center shrink-0">{iconEl}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className="text-ink text-xs sm:text-sm font-medium">{DOC_LABELS[docType]}</p>
            {statusBadge}
          </div>
          {exStatus === 'rejected' && existingDoc?.rejection_reason && (
            <p className="text-red-600/70 text-[11px] mt-0.5 line-clamp-1">"{existingDoc.rejection_reason}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {stagedDoc && (
            <button
              onClick={() => onRemove(stagedDoc.id)}
              disabled={isRemoving}
              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
            >
              {isRemoving ? <Spinner size={13} /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {(frontUrl || backUrl) && (
        <div className="ml-10 sm:ml-11 flex gap-2">
          {frontUrl && <DocThumb url={frontUrl} label="Front" />}
          {backUrl  && <DocThumb url={backUrl}  label="Back"  />}
        </div>
      )}

      {stagedDoc?.provided_number && (
        <div className="ml-10 sm:ml-11 inline-flex items-center gap-1.5 text-[11px] text-ink-muted bg-surface-soft rounded-md px-2 py-1 border border-line">
          <Hash size={10} /> <span className="font-mono">{stagedDoc.provided_number}</span>
        </div>
      )}

      {stagedDoc?.vehicle_categories?.length > 0 && (
        <div className="ml-10 sm:ml-11 flex flex-wrap gap-1">
          {stagedDoc.vehicle_categories.map(t => {
            const all = vehicleMaster
              ? [...(vehicleMaster.two_wheel || []), ...(vehicleMaster.three_wheel || []), ...(vehicleMaster.car_side || [])]
              : [];
            const label = all.find(v => v.vehicle_type === t)?.display_name || t;
            return (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-400">
                {label}
              </span>
            );
          })}
        </div>
      )}

      {showUpload && (
        <div className="ml-10 sm:ml-11 space-y-2">
          {wantsNumber && (
            <div>
              <input
                value={number}
                onChange={e => setNumber(e.target.value.toUpperCase())}
                placeholder={docNumberPlaceholder(docType)}
                inputMode={docType === 'AADHAAR' ? 'numeric' : 'text'}
                className={`w-full bg-white rounded-lg px-3 py-2 text-sm text-ink outline-none border font-mono tracking-wide
                  ${numberInvalid
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-line focus:border-brand-600'}`}
              />
              <p className={`text-[10px] mt-1 leading-relaxed ${numberInvalid ? 'text-red-600' : 'text-ink-faint'}`}>
                {numberInvalid ? v.error : `${docNumberHelp(docType)} · optional but recommended`}
              </p>
            </div>
          )}
          <div className="flex gap-1.5 sm:gap-2">
            <FileBtn side="Front" file={front} onChange={setFront} />
            {HAS_BACK.has(docType) && <FileBtn side="Back (rec.)" file={back} onChange={setBack} />}
          </div>
          {wantsCategories && (
            <CategoryPicker master={vehicleMaster} value={categories} onChange={setCategories} error={vmError} />
          )}
          {front && (
            <button
              onClick={doUpload}
              disabled={isUploading || numberInvalid}
              className="w-full py-2 rounded-lg bg-brand-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-brand-800 transition disabled:opacity-60"
            >
              {isUploading ? <Spinner size={12} /> : <Upload size={12} />}
              {exStatus === 'rejected' || exStatus === 'manual_review' ? 'Re-upload' : 'Upload'} {DOC_LABELS[docType]}
            </button>
          )}
        </div>
      )}

      {isProc && <p className="ml-10 sm:ml-11 text-blue-700 text-[11px] leading-relaxed">In a running batch — wait before re-uploading.</p>}
      {isTerminal && <p className="ml-10 sm:ml-11 text-ink-faint text-[11px]">Already verified. Reject existing doc first to re-verify.</p>}

      {existingDoc?.extracted_data && (isTerminal || exStatus === 'manual_review') && (
        <div className="ml-10 sm:ml-11">
          <ExtractedDataPanel docType={docType} data={existingDoc.extracted_data} score={existingDoc.confidence_score} />
        </div>
      )}
    </div>
  );
}
