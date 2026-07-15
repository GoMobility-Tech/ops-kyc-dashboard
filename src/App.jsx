import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage       from './pages/LoginPage.jsx';
import AppShell        from './components/layout/AppShell.jsx';
import RequireAuth     from './components/layout/RequireAuth.jsx';
import { firstAvailableRoute } from './components/layout/moduleRoutes.js';
import { getToken, getModules } from './utils/auth.js';

import MyDriversPage        from './pages/my-drivers/MyDriversPage.jsx';
import MyDriversRegister    from './pages/my-drivers/RegisterPage.jsx';
import MyDriversWorkspace   from './pages/my-drivers/WorkspacePage.jsx';

import AllDriversPage       from './pages/all-drivers/AllDriversPage.jsx';
import AllDriversDetail     from './pages/all-drivers/DetailPage.jsx';

import LogsPage             from './pages/logs/LogsPage.jsx';

function RootRedirect() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Navigate to={firstAvailableRoute(getModules())} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        {/* my_drivers module */}
        <Route path="/my-drivers"
          element={<RequireAuth moduleKey="my_drivers"><MyDriversPage /></RequireAuth>} />
        <Route path="/my-drivers/new"
          element={<RequireAuth moduleKey="my_drivers"><MyDriversRegister /></RequireAuth>} />
        <Route path="/my-drivers/:userId"
          element={<RequireAuth moduleKey="my_drivers"><MyDriversWorkspace /></RequireAuth>} />
        <Route path="/my-drivers/:userId/batch/:batchId"
          element={<RequireAuth moduleKey="my_drivers"><MyDriversWorkspace /></RequireAuth>} />

        {/* all_drivers module */}
        <Route path="/all-drivers"
          element={<RequireAuth moduleKey="all_drivers"><AllDriversPage /></RequireAuth>} />
        <Route path="/all-drivers/:userId"
          element={<RequireAuth moduleKey="all_drivers"><AllDriversDetail /></RequireAuth>} />
        <Route path="/all-drivers/:userId/batch/:batchId"
          element={<RequireAuth moduleKey="all_drivers"><AllDriversDetail /></RequireAuth>} />

        {/* logs module */}
        <Route path="/logs"
          element={<RequireAuth moduleKey="logs"><LogsPage /></RequireAuth>} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
