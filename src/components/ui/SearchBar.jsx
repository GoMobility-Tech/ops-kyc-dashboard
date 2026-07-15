import React, { useState, useEffect } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';

/**
 * Search bar with Enter-to-submit, clear button, and consistent brand styling.
 *
 * Props:
 *   value       — controlled string
 *   onChange    — (v) => void  (fires on keystroke, does NOT fetch)
 *   onSubmit    — (v) => void  (fires on Enter or clear)
 *   placeholder — string
 *   hint        — optional caption below
 */
export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search…',
  hint,
  autoFocus = false,
  className = '',
}) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  const submit = (e) => {
    e?.preventDefault();
    onChange?.(local);
    onSubmit?.(local);
  };

  const clear = () => {
    setLocal('');
    onChange?.('');
    onSubmit?.('');
  };

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-line focus-within:border-accent-navy focus-within:ring-2 focus-within:ring-brand-500/30 transition">
        <Search size={14} className="text-accent-navy shrink-0" />
        <input
          type="search"
          value={local}
          onChange={e => setLocal(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-ink text-sm outline-none placeholder:text-ink-faint min-w-0"
        />
        {local ? (
          <button
            type="button"
            onClick={clear}
            className="text-ink-faint hover:text-red-600 transition shrink-0"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <span className="text-ink-faint text-[10px] hidden sm:inline-flex items-center gap-1">
            <CornerDownLeft size={10} /> Enter
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{hint}</p>}
    </form>
  );
}
