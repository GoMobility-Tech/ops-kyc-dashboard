// Passenger KYC — shared status / flag metadata.
// Passenger flow has NO approve-reject: docs auto-verify, mismatches raise flags.
// `rejected` / `manual_review` never appear here (those are driver-only statuses).

import {
  CheckCircle2, Clock, CircleDashed, XCircle,
  UserX, Copy, ScanFace, ScanEye, Baby, ImageOff, Hash,
} from 'lucide-react';

export const STATUS_META = {
  verified:    { label: 'Verified',    tone: 'success', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', tone: 'warning', icon: Clock },
  not_started: { label: 'Not Started', tone: 'neutral', icon: CircleDashed },
};

export const STATUS_FILTERS = [
  { value: '',            label: 'All statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'verified',    label: 'Verified' },
];

export const FLAG_FILTERS = [
  { value: '1', label: 'Flagged only' },
  { value: '0', label: 'Not flagged' },
  { value: '',  label: 'All passengers' },
];

export const DOC_STATUS_META = {
  auto_verified: { label: 'Auto verified', tone: 'success', icon: CheckCircle2 },
  failed:        { label: 'Failed',        tone: 'danger',  icon: XCircle },
  pending:       { label: 'Pending',       tone: 'warning', icon: Clock },
};

// `tone` drives the chip colour; `hint` is what ops should actually check.
export const FLAG_META = {
  NAME_MISMATCH: {
    label: 'Name mismatch',
    tone: 'warning',
    icon: UserX,
    why: 'Aadhaar name vs profile name similarity below 50%.',
    hint: 'Middle name, spelling, or surname changed after marriage — usually genuine.',
  },
  AADHAAR_DUPLICATE: {
    label: 'Aadhaar duplicate',
    tone: 'danger',
    icon: Copy,
    why: 'The same Aadhaar number already exists on another passenger account.',
    hint: 'Compare both accounts via duplicate_of_user_id — real duplicate, or a family member sharing a phone.',
  },
  FACE_MATCH_LOW: {
    label: 'Face match low',
    tone: 'warning',
    icon: ScanFace,
    why: 'Face score below the threshold, but the provider still matched.',
    hint: 'Eyeball the selfie against the Aadhaar photo — old photo or bad lighting is common.',
  },
  FACE_MATCH_FAILED: {
    label: 'Face match failed',
    tone: 'danger',
    icon: ScanEye,
    why: 'Provider returned a no-match.',
    hint: 'Most serious flag — inspect both images carefully.',
  },
  MINOR: {
    label: 'Minor',
    tone: 'danger',
    icon: Baby,
    why: 'Age computed from the Aadhaar DOB is under 18.',
    hint: 'Either the DOB was misread by OCR, or the passenger really is a minor.',
  },
  OCR_LOW_CONFIDENCE: {
    label: 'Low OCR confidence',
    tone: 'info',
    icon: ImageOff,
    why: 'Image was blurred, glared, or only partially visible.',
    hint: 'Almost always an image-quality issue, not fraud.',
  },
  NUMBER_MISMATCH: {
    label: 'Number mismatch',
    tone: 'warning',
    icon: Hash,
    why: 'Aadhaar number typed by the user differs from the OCR reading.',
    hint: 'Typo, or the wrong document was uploaded.',
  },
};

export const flagMeta = (code) =>
  FLAG_META[code] || {
    label: String(code || '').replace(/_/g, ' ').toLowerCase(),
    tone: 'neutral',
    icon: null,
    why: '',
    hint: '',
  };

export const FACE_MATCH_DEFAULT_THRESHOLD = 60;

export const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
};

export const fmtDate = (val) => {
  if (!val) return '—';
  // DOB arrives as `1996-05-12` on the passenger object and `12-05-1996` inside OCR data.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(val);
  if (!iso) return val;
  try {
    return new Date(`${val}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return val; }
};
