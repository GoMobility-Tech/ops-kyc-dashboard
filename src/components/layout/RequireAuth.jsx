import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, getModules, hasModule, isElevatedRole } from '../../utils/auth.js';
import { firstAvailableRoute, MODULE_ROUTES } from './moduleRoutes.js';

/**
 * Route guard.
 * - Not logged in → /login
 * - Logged in but visiting a module route the user hasn't been granted →
 *   redirect to first available module (or /login if none).
 *
 * `moduleKey` — optional. Only enforce module check if provided.
 */
export default function RequireAuth({ moduleKey, children }) {
  const loc = useLocation();

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (moduleKey && !isElevatedRole() && !hasModule(moduleKey)) {
    const modules = getModules();
    const fallback = firstAvailableRoute(modules);
    // Avoid redirect loop if fallback === current
    if (fallback === loc.pathname) return null;
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export { MODULE_ROUTES };
