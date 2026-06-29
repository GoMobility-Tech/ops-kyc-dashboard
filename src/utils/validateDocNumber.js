// Per doc-type number validation. Strip spaces / dashes / dots and uppercase first.
// Backend also normalizes; this is purely UX.
// Returns: { valid, normalized, error? }.
// Empty input is treated as VALID (number is optional) — caller decides whether
// to require it. Only show an error when the user has typed something invalid.
export const validateDocNumber = (docType, raw) => {
  const cleaned = String(raw || '').replace(/[\s\-_./]/g, '').toUpperCase();
  if (!cleaned) return { valid: true, normalized: '' };

  switch (docType) {
    case 'AADHAAR':
      return /^\d{12}$/.test(cleaned)
        ? { valid: true, normalized: cleaned }
        : { valid: false, normalized: cleaned, error: '12 digits expected' };
    case 'PAN':
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(cleaned)
        ? { valid: true, normalized: cleaned }
        : { valid: false, normalized: cleaned, error: 'Format: ABCDE1234F' };
    case 'DRIVING_LICENCE':
      return /^[A-Z0-9]{8,16}$/.test(cleaned)
        ? { valid: true, normalized: cleaned }
        : { valid: false, normalized: cleaned, error: '8–16 alphanumeric chars' };
    case 'VEHICLE_RC':
      return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(cleaned)
        ? { valid: true, normalized: cleaned }
        : { valid: false, normalized: cleaned, error: 'Format: UP14AB1234' };
    default:
      return { valid: true, normalized: cleaned };
  }
};

export const docNumberPlaceholder = (docType) => ({
  AADHAAR:         '1234 5678 9012',
  PAN:             'ABCDE1234F',
  DRIVING_LICENCE: 'DL-1420110012345',
  VEHICLE_RC:      'UP14AB1234',
}[docType] || '');

export const docNumberHelp = (docType) => ({
  AADHAAR:         '12 digits — OCR cross-check; mismatch hua to soft retry milega',
  PAN:             '5 letters + 4 digits + 1 letter',
  DRIVING_LICENCE: '8–16 alphanumeric chars (no spaces/dashes)',
  VEHICLE_RC:      'State code + digits + series, e.g. UP14AB1234',
}[docType] || '');
