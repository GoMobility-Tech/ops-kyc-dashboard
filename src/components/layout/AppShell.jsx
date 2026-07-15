import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import { MODULE_ROUTES } from './moduleRoutes.js';
import { getModules } from '../../utils/auth.js';

// Derive current page title from route + modules (falls back to a sensible label)
function useTitle() {
  const { pathname } = useLocation();
  const modules = getModules();
  const activeKey = Object.entries(MODULE_ROUTES).find(([, r]) => pathname.startsWith(r))?.[0];
  return modules.find(m => m.key === activeKey)?.label
    || (activeKey ? activeKey.replace(/_/g, ' ') : '');
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = useTitle();

  return (
    <div className="min-h-screen bg-brand-100 flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
