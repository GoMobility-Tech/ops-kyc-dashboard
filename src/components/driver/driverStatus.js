// Shared helpers for reading doc/KYC status out of any driver row shape.
// Backend returns different shapes across endpoints:
//   /ops/me/drivers list      → { documents:[{documentType,status}], verifiedDocs:[], stagedDocs:[], missingDocs:[], ... }
//   /kyc/admin/drivers list   → { verified_docs_count, submitted_docs_count } — no per-doc detail
//   /kyc/admin/drivers/:id    → { driver:{...}, documents:[{document_type,status}] }
//   /ops/me/drivers/:id       → { documents:[{documentType,status}], completionPct, ... }

export const TOTAL_DOCS = 6;

export const DOCS_META = [
  { key: 'aadhaar', short: 'A',  label: 'Aadhaar',        apiType: 'AADHAAR' },
  { key: 'pan',     short: 'P',  label: 'PAN',            apiType: 'PAN' },
  { key: 'dl',      short: 'DL', label: 'Driving Licence',apiType: 'DRIVING_LICENCE' },
  { key: 'rc',      short: 'RC', label: 'Vehicle RC',     apiType: 'VEHICLE_RC' },
  { key: 'selfie',  short: 'S',  label: 'Selfie',         apiType: 'SELFIE' },
  { key: 'bank',    short: 'B',  label: 'Bank Account',   apiType: 'BANK_ACCOUNT' },
];

export const DONE_STATES = new Set(['verified', 'auto_verified', 'approved']);

// Read per-doc status for a specific meta.apiType from any driver row shape.
// Returns status string or `null` if no per-doc data available at all.
export function statusForDoc(driver, meta) {
  if (!driver) return null;

  // 1. Preferred — dense docBreakdown/doc_breakdown map (backend now returns this
  //    on both list + detail with all 6 keys, missing = 'not_started').
  const bd = driver.doc_breakdown || driver.docBreakdown;
  if (bd && bd[meta.apiType]) return bd[meta.apiType];
  if (bd && bd[meta.key])     return bd[meta.key];

  // 2. documents array with per-doc status
  const docs = driver.documents;
  if (Array.isArray(docs) && docs.length) {
    const found = docs.find(d => (d.documentType || d.document_type) === meta.apiType);
    if (found) return found.status || 'not_started';
  }

  // 3. Explicit arrays of docs by state
  const inArray = (arr) => Array.isArray(arr) && arr.includes(meta.apiType);
  if (inArray(driver.verified_docs) || inArray(driver.verifiedDocs)) return 'verified';
  if (inArray(driver.stagedDocs))     return 'staged';
  if (inArray(driver.processingDocs)) return 'processing';
  if (inArray(driver.needsReview))    return 'manual_review';
  if (inArray(driver.rejectedDocs))   return 'rejected';
  if (inArray(driver.missingDocs))    return 'not_started';

  // 4. Boolean flags (camel or snake)
  const camel = { aadhaar: 'aadhaarVerified', pan: 'panVerified', dl: 'dlVerified',
                  rc: 'rcVerified', selfie: 'selfieVerified', bank: 'bankVerified' }[meta.key];
  const snake = camel && camel.replace(/([A-Z])/g, '_$1').toLowerCase();
  const kyc = driver.kycStatus || driver.kyc_status || driver;
  const flag = kyc?.[camel] ?? driver[snake];
  if (flag === true)  return 'verified';
  if (flag === false) return 'not_started';

  return null;
}

// Whether any per-doc status data is available.
export function hasPerDocData(driver) {
  if (!driver) return false;
  if (driver.doc_breakdown || driver.docBreakdown) return true;
  if (Array.isArray(driver.documents) && driver.documents.length) return true;
  const anyArr = ['verified_docs', 'verifiedDocs', 'stagedDocs', 'missingDocs', 'processingDocs', 'rejectedDocs', 'needsReview'];
  if (anyArr.some(k => Array.isArray(driver[k]) && driver[k].length)) return true;
  const flags = ['aadhaarVerified', 'panVerified', 'dlVerified', 'rcVerified', 'selfieVerified', 'bankVerified'];
  const kyc = driver.kycStatus || driver.kyc_status || driver;
  if (kyc && flags.some(f => kyc[f] != null)) return true;
  return false;
}

// Count verified docs regardless of source shape.
export function countVerified(driver) {
  if (!driver) return 0;

  // 1. Preferred — server-computed verified_docs array (both list + detail)
  if (Array.isArray(driver.verified_docs)) return driver.verified_docs.length;
  if (Array.isArray(driver.verifiedDocs))  return driver.verifiedDocs.length;

  // 2. Derive from doc_breakdown
  const bd = driver.doc_breakdown || driver.docBreakdown;
  if (bd && typeof bd === 'object') {
    return Object.values(bd).filter(s => DONE_STATES.has(s)).length;
  }

  // 3. Documents array
  const docs = driver.documents;
  if (Array.isArray(docs) && docs.length) {
    return docs.filter(d => DONE_STATES.has(d.status)).length;
  }

  // 4. Fall back to (potentially stale) server counts
  const count = driver.verifiedDocsCount ?? driver.verified_docs_count;
  if (count != null) return count;

  const flags = ['aadhaarVerified', 'panVerified', 'dlVerified', 'rcVerified', 'selfieVerified', 'bankVerified'];
  const kyc = driver.kycStatus || driver.kyc_status || driver;
  return flags.filter(f => kyc?.[f]).length;
}

// Total expected docs — server may override the default 6 via `total_docs_expected`.
export function expectedTotal(driver) {
  if (driver?.total_docs_expected != null) return driver.total_docs_expected;
  if (driver?.totalDocsExpected != null)   return driver.totalDocsExpected;
  return TOTAL_DOCS;
}

// Completion % — prefer server value; fall back to counted / expected.
export function computePct(driver) {
  const server = driver?.completion_pct ?? driver?.completionPct;
  if (server != null) return Math.min(100, Math.round(server));
  const total = expectedTotal(driver);
  return Math.min(100, Math.round((countVerified(driver) / total) * 100));
}
