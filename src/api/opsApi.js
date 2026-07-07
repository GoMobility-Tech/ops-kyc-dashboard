import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'https://api.gomobility.co.in/api/v1';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('ops_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Ops Auth ─────────────────────────────────────────────────────────────────
export const opsLogin = (email, password) => {
  let deviceId = localStorage.getItem('ops_device_id');
  if (!deviceId) {
    deviceId = (crypto.randomUUID && crypto.randomUUID()) || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ops_device_id', deviceId);
  }
  return api.post('/auth/ops/login', {
    email,
    password,
    device_info: { deviceId, deviceType: 'web' },
  });
};

// ─── Driver Registration — ops-only, no OTP needed ───────────────────────────
// POST /ops/drivers/register → single call, returns userId immediately
export const registerDriver = ({ fullName, phone, email }) =>
  api.post('/ops/drivers/register', { fullName, phone, ...(email ? { email } : {}) });

// ─── Driver Search ─────────────────────────────────────────────────────────────
export const searchDrivers = (query) =>
  api.get('/kyc/admin/drivers', { params: { search: query, limit: 20 } });

export const getDriverKycDetail = (userId) =>
  api.get(`/kyc/admin/drivers/${userId}`);

// ─── My Workspace ─────────────────────────────────────────────────────────────
export const getMyStats = () =>
  api.get('/ops/me/stats');

export const getMyDrivers = ({ status, search, page = 1, limit = 20 } = {}) =>
  api.get('/ops/me/drivers', {
    params: {
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      page, limit,
    },
  });

export const getMyDriverDetail = (userId) =>
  api.get(`/ops/me/drivers/${userId}`);

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

// ─── KYC Admin — Review Queue / Doc Detail / Fraud / Suspend ─────────────────
export const getReviewQueue = ({ type, status = 'manual_review', page = 1, limit = 20 } = {}) =>
  api.get('/kyc/admin/queue', {
    params: {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      page, limit,
    },
  });

export const getDocumentDetail = (docId) =>
  api.get(`/kyc/admin/documents/${docId}`);

export const getFraudAlerts = ({ severity } = {}) =>
  api.get('/kyc/admin/fraud-alerts', {
    params: { ...(severity ? { severity } : {}) },
  });

// ─── Bank Verify (Ops inline penny-drop) ──────────────────────────────────────
export const verifyDriverBank = (userId, { account_number, ifsc, name }) =>
  api.post(`/ops/kyc/drivers/${userId}/bank`, { account_number, ifsc, name });

// ─── Vehicle Master (for RC category selector) ───────────────────────────────
export const getVehicleMaster = () =>
  api.get('/admin/pricing/vehicles');
