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

import PassengerKycPage     from './pages/passenger-kyc/PassengerKycPage.jsx';
import PassengerKycDetail   from './pages/passenger-kyc/PassengerDetailPage.jsx';

import DriversListPage      from './pages/driver-metrics/DriversListPage.jsx';
import LiveMapPage          from './pages/driver-metrics/LiveMapPage.jsx';
import DriverMetricsDetail  from './pages/driver-metrics/DriverDetailPage.jsx';
import FleetAnalyticsPage   from './pages/driver-metrics/FleetAnalyticsPage.jsx';

import LogsPage             from './pages/logs/LogsPage.jsx';
import ReviewQueuePage      from './pages/review-queue/ReviewQueuePage.jsx';
import PaymentOrdersPage    from './pages/payment-orders/PaymentOrdersPage.jsx';
import TransactionsPage     from './pages/transactions/TransactionsPage.jsx';

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

        {/* payment_orders module */}
        <Route path="/payment-orders"
          element={<RequireAuth moduleKey="payment_orders"><PaymentOrdersPage /></RequireAuth>} />

        {/* transactions module */}
        <Route path="/transactions"
          element={<RequireAuth moduleKey="transactions"><TransactionsPage /></RequireAuth>} />

        {/* passenger_kyc module */}
        <Route path="/passenger-kyc"
          element={<RequireAuth moduleKey="passenger_kyc"><PassengerKycPage /></RequireAuth>} />
        <Route path="/passenger-kyc/:userId"
          element={<RequireAuth moduleKey="passenger_kyc"><PassengerKycDetail /></RequireAuth>} />

        {/* driver_metrics module — the roster is the entry point; the live map
            is a companion view that only ever shows online drivers */}
        <Route path="/driver-metrics"
          element={<RequireAuth moduleKey="driver_metrics"><DriversListPage /></RequireAuth>} />
        <Route path="/driver-metrics/map"
          element={<RequireAuth moduleKey="driver_metrics"><LiveMapPage /></RequireAuth>} />
        <Route path="/driver-metrics/fleet"
          element={<RequireAuth moduleKey="driver_metrics"><FleetAnalyticsPage /></RequireAuth>} />
        <Route path="/driver-metrics/drivers/:driverId"
          element={<RequireAuth moduleKey="driver_metrics"><DriverMetricsDetail /></RequireAuth>} />

        {/* logs module */}
        <Route path="/logs"
          element={<RequireAuth moduleKey="logs"><LogsPage /></RequireAuth>} />

        {/* Review queue — gated by all_drivers since it uses admin endpoints */}
        <Route path="/review-queue"
          element={<RequireAuth moduleKey="all_drivers"><ReviewQueuePage /></RequireAuth>} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
