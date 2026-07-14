// Lightweight auth helpers — token, user, and modules persisted in localStorage.

const T_KEY = 'ops_token';
const R_KEY = 'ops_role';
const N_KEY = 'ops_name';
const E_KEY = 'ops_email';
const M_KEY = 'ops_modules';

export const getToken = () => localStorage.getItem(T_KEY);
export const setToken = (t) => { if (t) localStorage.setItem(T_KEY, t); };

export const getRole  = () => localStorage.getItem(R_KEY) || 'ops_team';
export const getName  = () => localStorage.getItem(N_KEY) || '';
export const getEmail = () => localStorage.getItem(E_KEY) || '';

export const getModules = () => {
  try { return JSON.parse(localStorage.getItem(M_KEY) || '[]'); }
  catch { return []; }
};

export const setSession = ({ token, role, name, email, modules }) => {
  if (token)  localStorage.setItem(T_KEY, token);
  if (role)   localStorage.setItem(R_KEY, role);
  if (name)   localStorage.setItem(N_KEY, name);
  if (email)  localStorage.setItem(E_KEY, email);
  if (Array.isArray(modules)) localStorage.setItem(M_KEY, JSON.stringify(modules));
};

export const setModules = (modules) => {
  if (Array.isArray(modules)) localStorage.setItem(M_KEY, JSON.stringify(modules));
};

export const clearSession = () => {
  localStorage.removeItem(T_KEY);
  localStorage.removeItem(R_KEY);
  localStorage.removeItem(N_KEY);
  localStorage.removeItem(E_KEY);
  localStorage.removeItem(M_KEY);
};

// admin/super_admin see everything — treat as unrestricted
export const isElevatedRole = (role = getRole()) =>
  role === 'admin' || role === 'super_admin';

export const hasModule = (key) => {
  if (isElevatedRole()) return true;
  return getModules().some(m => m.key === key);
};
