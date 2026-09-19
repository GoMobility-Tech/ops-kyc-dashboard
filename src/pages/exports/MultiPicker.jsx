import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

// ─── Multi-select dropdown ──────────────────────────────────────────────────
//
// Ek hi control, jaisa har dhang ke dashboard me hota hai: band box jo batata
// hai kya chuna hai, khulne pe search aur checkbox rows.
//
// Chips jaan-bujh ke nahi hain. Passengers pe 28 filters hain — har filter ki
// chips ki line screen ko itna lamba kar deti hai ki exports ki table dikhti
// hi nahi. Aur 522 cities chips me dikhana mumkin hi nahi.
//
// City groups (NCR / Tricity / enabled) bhi isi list me upar ek section hain,
// alag chips nahi. Ek hi jagah, ek hi tarah se chunte ho.

export default function MultiPicker({
  label, hint, options = [], value = [], onChange,
  placeholder = 'Any', groups = null, onGroupToggle, activeGroups = [],
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
  const activeG  = Array.isArray(activeGroups) ? activeGroups : [];

  const needle = q.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!needle) return options;
    return options.filter(o =>
      String(o.label).toLowerCase().includes(needle) ||
      String(o.state || '').toLowerCase().includes(needle));
  }, [options, needle]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!needle) return groups;
    return groups.filter(g => String(g.label).toLowerCase().includes(needle));
  }, [groups, needle]);

  const toggle = (v) => onChange(
    selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  const count = selected.length + activeG.length;

  // Band box pe kya likha ho. Do naam tak poore; usse zyada pe ginti, kyunki
  // "Chandigarh, Delhi, Gurgaon, Noida +7" padha nahi jaata.
  const summary = useMemo(() => {
    const gl = (groups || []).filter(g => activeG.includes(g.value)).map(g => g.label);
    const nl = selected.map(v => options.find(o => o.value === v)?.label).filter(Boolean);
    const all = [...gl, ...nl];
    if (!all.length) return null;
    if (all.length <= 2) return all.join(', ');
    return `${all.slice(0, 2).join(', ')} +${all.length - 2}`;
  }, [groups, activeG, selected, options]);

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
    onGroupToggle?.(null);
  };

  const Row = ({ on, onClick, children, right }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition
        ${on ? 'bg-brand-100/70 text-accent-navy font-medium' : 'hover:bg-surface-alt text-ink'}`}
    >
      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
        ${on ? 'bg-accent-navy border-accent-navy' : 'border-line bg-white'}`}>
        {on && <Check size={11} className="text-white" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {right}
    </button>
  );

  return (
    <div ref={ref}>
      {label && <p className="text-xs font-medium text-ink-muted mb-1">{label}</p>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border text-left transition
            ${count ? 'border-brand-600 ring-1 ring-brand-500/25' : 'border-line hover:border-accent-navy'}`}
        >
          <span className={`text-sm truncate ${count ? 'text-ink font-medium' : 'text-ink-faint'}`}>
            {summary || placeholder}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {count > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={clearAll}
                onKeyDown={(e) => { if (e.key === 'Enter') clearAll(e); }}
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
            {options.length > 8 && (
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

            <div className="max-h-64 overflow-y-auto">
              {/* Groups — alag chips nahi, isi list ka pehla section */}
              {filteredGroups.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                    Groups
                  </p>
                  {filteredGroups.map(g => (
                    <Row
                      key={g.value}
                      on={activeG.includes(g.value)}
                      onClick={() => onGroupToggle?.(g.value)}
                      right={g.cityCount != null
                        ? <span className="text-[11px] text-ink-faint tabular-nums">{g.cityCount}</span>
                        : null}
                    >
                      {g.label}
                    </Row>
                  ))}
                  {filteredOptions.length > 0 && (
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold border-t border-line mt-1">
                      Cities
                    </p>
                  )}
                </>
              )}

              {filteredOptions.length === 0 && filteredGroups.length === 0 ? (
                <p className="px-3 py-4 text-xs text-ink-faint text-center">Nothing matches</p>
              ) : filteredOptions.map(o => (
                <Row
                  key={o.value}
                  on={selected.includes(o.value)}
                  onClick={() => toggle(o.value)}
                  right={
                    <span className="flex items-center gap-2 shrink-0">
                      {o.state && <span className="text-[11px] text-ink-faint">{o.state}</span>}
                      {/* Band sheher alag dikhta hai — warna log wahan ka data
                          maang ke khaali sheet paate hain. */}
                      {o.isActive === false && <span className="text-[10px] text-ink-faint">off</span>}
                    </span>
                  }
                >
                  {o.label}
                </Row>
              ))}
            </div>

            {count > 0 && (
              <div className="border-t border-line px-3 py-1.5 flex items-center justify-between">
                <span className="text-[11px] text-ink-muted tabular-nums">{count} selected</span>
                <button type="button" onClick={clearAll}
                        className="text-[11px] text-ink-muted hover:text-red-600 font-medium">
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}
