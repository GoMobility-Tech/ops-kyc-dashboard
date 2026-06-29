// Lightweight auth helpers — token + role persisted in localStorage.

export const getToken = () => localStorage.getItem('ops_token');
export const getRole  = () => localStorage.getItem('ops_role') || 'ops_team';
export const getName  = () => localStorage.getItem('ops_name') || '';

export const isAdmin = () => {
  const r = getRole();
  return r === 'admin' || r === 'super_admin';
};

export const setSession = ({ token, role, name }) => {
  if (token) localStorage.setItem('ops_token', token);
  if (role)  localStorage.setItem('ops_role',  role);
  if (name)  localStorage.setItem('ops_name',  name);
};

export const clearSession = () => {
  localStorage.removeItem('ops_token');
  localStorage.removeItem('ops_role');
  localStorage.removeItem('ops_name');
};
