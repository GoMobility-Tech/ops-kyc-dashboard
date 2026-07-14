import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${width} rounded-t-2xl sm:rounded-2xl border border-line shadow-pop overflow-hidden max-h-[92vh] flex flex-col`}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-brand-100 transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 bg-surface-soft">{footer}</div>}
      </div>
    </div>
  );
}
