import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage           from './pages/LoginPage.jsx';
import MyWorkspacePage     from './pages/MyWorkspacePage.jsx';
import DriverSearchPage    from './pages/DriverSearchPage.jsx';
import DriverRegisterPage  from './pages/DriverRegisterPage.jsx';
import DriverKycWorkspace  from './pages/DriverKycWorkspace.jsx';

const isAuth = () => !!localStorage.getItem('ops_token');

const Private = ({ children }) =>
  isAuth() ? children : <Navigate to="/login" replace />;

export default function App() {
  return (
    <Routes>
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/"        element={<Private><MyWorkspacePage /></Private>} />
      <Route path="/search"  element={<Private><DriverSearchPage /></Private>} />
      <Route path="/driver/new"
                             element={<Private><DriverRegisterPage /></Private>} />
      <Route path="/driver/:userId"
                             element={<Private><DriverKycWorkspace /></Private>} />
      <Route path="/driver/:userId/batch/:batchId"
                             element={<Private><DriverKycWorkspace /></Private>} />
      <Route path="*"        element={<Navigate to="/" replace />} />
    </Routes>
  );
}
