import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'https://api.gomobility.co.in/api/v1';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('ops_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────
export const sendOtp   = (phone)       => api.post('/auth/signin',        { phone, role: 'ops_team' });
export const verifyOtp = (phone, otp)  => api.post('/auth/verify-signin', { phone, otp, role: 'ops_team' });

// ─── Driver Registration — ops-only, no OTP needed ───────────────────────────
// POST /ops/drivers/register → single call, returns userId immediately
export const registerDriver = ({ fullName, phone, email }) =>
  api.post('/ops/drivers/register', { fullName, phone, ...(email ? { email } : {}) });

// ─── Driver Search ─────────────────────────────────────────────────────────────
export const searchDrivers = (query) =>
  api.get('/kyc/admin/drivers', { params: { search: query, limit: 20 } });

export const getDriverKycDetail = (userId) =>
  api.get(`/kyc/admin/drivers/${userId}`);

// ─── Ops KYC Staged Flow ──────────────────────────────────────────────────────
export const stageDocument = (userId, formData) =>
  api.post(`/ops/kyc/drivers/${userId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getStagedDocuments = (userId) =>
  api.get(`/ops/kyc/drivers/${userId}/documents/staged`);

export const removeStagedDocument = (userId, docId) =>
  api.delete(`/ops/kyc/drivers/${userId}/documents/${docId}`);

export const triggerBatchVerification = (userId) =>
  api.post(`/ops/kyc/drivers/${userId}/verify`, {});

export const getBatchStatus = (userId, batchId) =>
  api.get(`/ops/kyc/drivers/${userId}/verify/${batchId}`);

export const retryDeadJob = (jobId) =>
  api.post(`/ops/kyc/verify-jobs/${jobId}/retry`, {});

// ─── Manual Review Actions ────────────────────────────────────────────────────
export const approveDocument = (docId, notes) =>
  api.post(`/kyc/admin/documents/${docId}/approve`, { notes });

export const rejectDocument = (docId, reason, allowRetry = true) =>
  api.post(`/kyc/admin/documents/${docId}/reject`, { reason, allowRetry });

// ─── Bank Verify ──────────────────────────────────────────────────────────────
export const verifyBankAccount = (userId, data) =>
  api.post('/kyc/bank', { ...data, userId });
