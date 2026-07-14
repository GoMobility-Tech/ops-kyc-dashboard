import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { getIcon } from './iconMap.js';
import { MODULE_ROUTES, isKnownModule } from './moduleRoutes.js';
import { getModules } from '../../utils/auth.js';

export default function Sidebar({ open, onClose }) {
  const modules = getModules()
    .filter(m => isKnownModule(m.key))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-ink/40 z-30"
        />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-accent-navy shrink-0
        transform lg:transform-none transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.jpeg" alt="GO Mobility" className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-brand-500/40" />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">GO Mobility</p>
              <p className="text-brand-400 text-[11px] leading-tight">Ops Dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {modules.length === 0 ? (
            <p className="text-xs text-white/60 px-3 py-4 leading-relaxed">
              No modules granted yet. Contact your admin.
            </p>
          ) : (
            modules.map(m => {
              const Icon = getIcon(m.icon);
              const to   = MODULE_ROUTES[m.key];
              return (
                <NavLink
                  key={m.key}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                     ${isActive
                        ? 'bg-brand-600 text-accent-navy shadow-sm'
                        : 'text-white/75 hover:text-white hover:bg-white/10'}`
                  }
                >
                  <Icon size={16} />
                  <span className="flex-1 truncate">{m.label}</span>
                </NavLink>
              );
            })
          )}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-white/10 bg-black/20">
          <p className="text-[10px] text-brand-400/80 text-center leading-relaxed">
            Ops KYC · GO Mobility
          </p>
        </div>
      </aside>
    </>
  );
}
