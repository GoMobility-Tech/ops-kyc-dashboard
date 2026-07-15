import React from 'react';

const DOCS = [
  { key: 'aadhaar', short: 'A',  label: 'Aadhaar' },
  { key: 'pan',     short: 'P',  label: 'PAN' },
  { key: 'dl',      short: 'DL', label: 'DL' },
  { key: 'rc',      short: 'RC', label: 'RC' },
  { key: 'selfie',  short: 'S',  label: 'Selfie' },
  { key: 'bank',    short: 'B',  label: 'Bank' },
];

const TONES = {
  verified:       'bg-green-100  text-green-800  border-green-300',
  auto_verified:  'bg-green-100  text-green-800  border-green-300',
  approved:       'bg-green-100  text-green-800  border-green-300',
  staged:         'bg-brand-100  text-brand-800  border-brand-400',
  pending:        'bg-brand-100  text-brand-800  border-brand-400',
  processing:     'bg-blue-100   text-blue-800   border-blue-300',
  manual_review:  'bg-amber-100  text-amber-800  border-amber-300',
  rejected:       'bg-red-100    text-red-800    border-red-300',
  not_started:    'bg-white      text-ink-faint  border-line',
  null:           'bg-white      text-ink-faint  border-line',
};

// Read a status for the given key from various row shapes.
// Prefers `docBreakdown[key]` (from /ops/me/drivers) then flags like `aadhaarVerified`.
function statusFor(driver, key) {
  const bd = driver?.docBreakdown || driver?.doc_breakdown;
  if (bd && bd[key]) return bd[key];

  // Verified booleans (admin shape)
  const camelFlag = {
    aadhaar: 'aadhaarVerified', pan: 'panVerified', dl: 'dlVerified',
    rc: 'rcVerified', selfie: 'selfieVerified', bank: 'bankVerified',
  }[key];
  const snakeFlag = camelFlag && camelFlag.replace(/([A-Z])/g, '_$1').toLowerCase();
  const kyc = driver?.kycStatus || driver?.kyc_status || driver;
  const flagVal = kyc?.[camelFlag] ?? driver?.[snakeFlag];
  if (flagVal === true)  return 'verified';
  if (flagVal === false) return 'not_started';
  return 'not_started';
}

export default function DocStatusStrip({ driver }) {
  return (
    <div className="flex gap-1">
      {DOCS.map(d => {
        const st = statusFor(driver, d.key);
        const cls = TONES[st] || TONES.not_started;
        return (
          <span
            key={d.key}
            title={`${d.label}: ${(st || 'not_started').replace(/_/g, ' ')}`}
            className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1 rounded border text-[10px] font-bold ${cls}`}
          >
            {d.short}
          </span>
        );
      })}
    </div>
  );
}
