import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { clearSession, getName, getEmail, getRole } from '../../utils/auth.js';

export default function TopBar({ onOpenSidebar, title }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const name  = getName() || 'Ops Agent';
  const email = getEmail();
  const role  = getRole();
  const initial = (name[0] || 'O').toUpperCase();

  const logout = () => {
    clearSession();
    nav('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b-2 border-brand-500 px-3 sm:px-5 flex items-center gap-3 shadow-card">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden p-2 rounded-md text-accent-navy hover:bg-brand-100 transition"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 min-w-0">
        {title && <h1 className="text-sm font-semibold text-accent-navy truncate">{title}</h1>}
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-line hover:border-accent-navy hover:bg-surface-soft transition"
        >
          <span className="w-8 h-8 rounded-full bg-accent-navy text-brand-400 text-xs font-bold flex items-center justify-center ring-2 ring-brand-500/40">
            {initial}
          </span>
          <span className="hidden sm:block text-xs text-ink max-w-[130px] truncate font-medium">{name}</span>
          <ChevronDown size={14} className="text-ink-muted" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-line shadow-pop overflow-hidden">
            <div className="px-4 py-3 bg-accent-navy text-white">
              <p className="text-sm font-semibold truncate">{name}</p>
              {email && <p className="text-[11px] text-brand-400 truncate">{email}</p>}
              <p className="text-[10px] text-white/60 uppercase tracking-wider mt-1">{role.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-muted hover:text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
