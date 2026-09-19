import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

// ─── Dropdown jisme kai cheezein chun sakte ho ──────────────────────────────
//
// Chips ki jagah dropdown isliye: 522 cities ko chips me dikhana namumkin hai,
// aur 6 KYC statuses ko chips me dikhane se form itna lamba ho jaata hai ki
// neeche ka kuch dikhta hi nahi.
//
// Dropdown band rehta hai aur bas itna batata hai ki kitne chune hue hain.
// Khulne pe search hai, kyunki 522 me se apni city dhoondhna list scroll karke
// mumkin nahi.
export default function MultiPicker({
  label, hint, options = [], value = [], onChange,
  placeholder = 'Any', searchable = true, groups = null, onGroupToggle, activeGroups = [],
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
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

  const selected = Array.isArray(value) ? value : [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(o =>
      String(o.label).toLowerCase().includes(needle) ||
      String(o.state || '').toLowerCase().includes(needle));
  }, [options, q]);

  const toggle = (v) => onChange(
    selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  // Band dropdown pe kya likha ho. Do naam tak poore dikhte hain; usse zyada
  // pe ginti, kyunki "Chandigarh, Delhi, Gurgaon, Noida, +7" padha nahi jaata.
  const summary = (() => {
    const groupLabels = (groups || []).filter(g => activeGroups.includes(g.value)).map(g => g.label);
    const names = selected
      .map(v => options.find(o => o.value === v)?.label)
      .filter(Boolean);
    const all = [...groupLabels, ...names];
    if (!all.length) return null;
    if (all.length <= 2) return all.join(', ');
    return `${all.slice(0, 2).join(', ')} +${all.length - 2}`;
  })();

  const count = selected.length + (activeGroups?.length || 0);

  return (
    <div ref={ref}>
      {label && <p className="text-xs font-medium text-ink-muted mb-1">{label}</p>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border text-left transition
            ${count ? 'border-brand-600 ring-1 ring-brand-500/30' : 'border-line hover:border-accent-navy'}`}
        >
          <span className={`text-sm truncate ${count ? 'text-ink font-medium' : 'text-ink-faint'}`}>
            {summary || placeholder}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {count > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange([]); onGroupToggle?.(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange([]); onGroupToggle?.(null); } }}
                className="text-ink-faint hover:text-red-600 transition"
                aria-label="Clear"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown size={14} className={`text-ink-faint transition ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-line rounded-lg shadow-pop overflow-hidden">
            {/* Group shortcuts — sirf city filter pe aate hain */}
            {groups?.length > 0 && (
              <div className="p-2 border-b border-line bg-surface-alt">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">
                  Quick groups
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map(g => {
                    const on = activeGroups.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => onGroupToggle?.(g.value)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold transition
                          ${on ? 'bg-accent-navy text-white border-accent-navy'
                               : 'bg-white text-ink-muted border-line hover:border-accent-navy'}`}
                      >
                        {on && <Check size={9} />}
                        {g.label}
                        {g.cityCount != null && (
                          <span className={on ? 'text-brand-400' : 'text-ink-faint'}>{g.cityCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {searchable && options.length > 8 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
                <Search size={13} className="text-ink-faint shrink-0" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint min-w-0"
                />
              </div>
            )}

            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-ink-faint text-center">Nothing matches</p>
              ) : filtered.map(o => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition
                      ${on ? 'bg-brand-100 text-accent-navy font-medium' : 'hover:bg-surface-alt text-ink'}`}
                  >
                    <span className="truncate">
                      {o.label}
                      {o.state && <span className="text-[11px] text-ink-faint ml-1.5">{o.state}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {/* Band city ko alag dikhate hain — warna log wahan ka
                          data maang ke khaali sheet pate hain. */}
                      {o.isActive === false && (
                        <span className="text-[10px] text-ink-faint">off</span>
                      )}
                      {on && <Check size={13} className="text-accent-navy" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}
