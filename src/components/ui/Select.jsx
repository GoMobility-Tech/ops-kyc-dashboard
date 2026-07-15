import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Premium select — brand-styled, keyboard/click accessible.
 * options: [{ value, label, count?, icon? }]
 */
export default function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  disabled = false,
  size = 'md', // md | sm
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const current = options.find(o => o.value === value);
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          {label}
        </label>
      )}
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-2 bg-white rounded-lg border transition
            ${open
              ? 'border-accent-navy ring-2 ring-brand-500/30'
              : 'border-line hover:border-accent-navy'}
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            ${pad}`}
        >
          {current?.icon && <current.icon size={14} className="text-accent-navy shrink-0" />}
          <span className={`flex-1 text-left truncate ${current ? 'text-ink font-medium' : 'text-ink-faint'}`}>
            {current ? current.label : placeholder}
          </span>
          {current?.count != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-navy text-brand-400 font-bold tabular-nums">
              {current.count}
            </span>
          )}
          <ChevronDown size={14} className={`text-ink-muted transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 left-0 right-0 rounded-lg bg-white border border-line shadow-pop max-h-72 overflow-y-auto">
            {options.map(opt => {
              const active = opt.value === value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value ?? 'none'}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition
                    ${active
                      ? 'bg-brand-100 text-accent-navy font-semibold'
                      : 'text-ink hover:bg-surface-alt'}`}
                >
                  {Icon && <Icon size={13} className={active ? 'text-accent-navy' : 'text-ink-muted'} />}
                  <span className="flex-1 truncate text-sm">{opt.label}</span>
                  {opt.count != null && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-bold
                      ${active ? 'bg-accent-navy text-brand-400' : 'bg-surface-alt text-ink-muted'}`}>
                      {opt.count}
                    </span>
                  )}
                  {active && <Check size={13} className="text-accent-navy" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
