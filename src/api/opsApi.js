import axios from 'axios';
import { getToken, setToken, clearSession } from '../utils/auth.js';

const BASE = import.meta.env.VITE_API_URL || 'https://api.gomobility.co.in/api/v1';
const OTP_ACTION_TOKEN = import.meta.env.VITE_OPS_ACTION_TOKEN || '';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => {
    // Auto-rotate token when backend issues a fresh one
    const rotated = res.headers?.['x-new-access-token'];
    if (rotated) setToken(rotated);
    return res;
  },
  (err) => {
    const status = err.response?.status;
    // 401 anywhere → session dead, kick to login (except on the login call itself)
    if (status === 401 && !err.config?.url?.includes('/auth/ops/login')) {
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

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

export const getMyModules = () =>
  api.get('/admin/dashboard-modules/me');

// ─── Driver Registration (ops-only, no OTP) ──────────────────────────────────
export const registerDriver = ({ fullName, phone, email }) =>
  api.post('/ops/drivers/register', { fullName, phone, ...(email ? { email } : {}) });

// ─── Driver Search & Detail (admin scope — `all_drivers` module) ─────────────
export const searchDrivers = (query, { page = 1, limit = 20, status } = {}) =>
  api.get('/kyc/admin/drivers', {
    params: {
      ...(query ? { search: query } : {}),
      ...(status ? { status } : {}),
      page, limit,
    },
  });

export const getDriverKycDetail = (userId) =>
  api.get(`/kyc/admin/drivers/${userId}`);

// ─── My Workspace (`my_drivers` module) ──────────────────────────────────────
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

// ─── Edit driver (all_drivers module) ────────────────────────────────────────
export const updateDriverProfile = (userId, body) =>
  api.patch(`/ops/drivers/${userId}/profile`, body);

export const updateDriverVehicleCategories = (userId, categories) =>
  api.patch(`/ops/drivers/${userId}/vehicle/categories`, { vehicle_categories: categories });

// ─── Ops KYC Staged Flow ─────────────────────────────────────────────────────
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

export const editDocument = (docId, { document_number, status, file } = {}) => {
  const fd = new FormData();
  if (document_number != null) fd.append('document_number', document_number);
  if (status)                  fd.append('status', status);
  if (file)                    fd.append('file', file);
  return api.patch(`/kyc/admin/documents/${docId}/edit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ─── KYC Admin — Review Queue / Doc Detail / Fraud ────────────────────────────
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

// ─── Bank Verify (inline penny-drop) ─────────────────────────────────────────
export const verifyDriverBank = (userId, { account_number, ifsc, name }) =>
  api.post(`/ops/kyc/drivers/${userId}/bank`, { account_number, ifsc, name });

// ─── Vehicle Master ──────────────────────────────────────────────────────────
export const getVehicleMaster = () =>
  api.get('/admin/pricing/vehicles');

// ─── Sensitive: View driver's active OTP ─────────────────────────────────────
export const getDriverActiveOtp = (userId) =>
  api.get(`/kyc/admin/drivers/${userId}/otp`, {
    headers: OTP_ACTION_TOKEN ? { 'X-Action-Token': OTP_ACTION_TOKEN } : {},
  });

export const isOtpActionTokenConfigured = () => Boolean(OTP_ACTION_TOKEN);
