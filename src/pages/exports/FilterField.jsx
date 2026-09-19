import React from 'react';
import { Check } from 'lucide-react';
import { Input, Select, Badge } from '../../components/ui';

// ─── Ek filter, uske type ke hisaab se ──────────────────────────────────────
//
// Kaunsa filter dikhega ye BACKEND tay karta hai. Ye file sirf itna jaanti hai
// ki `text` ka matlab ek box hai aur `date_range` ka matlab do. Backend me
// naya filter add karne pe yahan kuch nahi badalta — bas ek naya field aa
// jaata hai.
//
// Isi liye har type ka fallback bhi hai: agar backend kabhi aisa type bheje jo
// yahan nahi hai, wo ek plain text box ban jaata hai — screen tooti nahi.

function Chip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition
        ${active
          ? 'bg-accent-navy text-white border-accent-navy'
          : 'bg-white text-ink-muted border-line hover:border-accent-navy hover:text-accent-navy'}`}
    >
      {active && <Check size={10} />}
      {children}
      {count != null && (
        <span className={`text-[10px] ${active ? 'text-brand-400' : 'text-ink-faint'}`}>{count}</span>
      )}
    </button>
  );
}

export default function FilterField({ spec, value, onChange, cityGroups = [] }) {
  const set = (v) => onChange(spec.key, v);
  const label = (
    <span className="flex items-center gap-1.5">
      {spec.label}
      {spec.unit && <span className="text-[10px] text-ink-faint">{spec.unit}</span>}
    </span>
  );

  switch (spec.type) {
    // ── Boolean — teen haal, do nahi ──────────────────────────────────────
    // "Yes / No / koi farak nahi". Khaali chhodna matlab filter lagta hi nahi,
    // aur wo alag baat hai "No" se.
    case 'boolean': {
      const opts = [
        { v: '',      t: 'Any' },
        { v: 'true',  t: 'Yes' },
        { v: 'false', t: 'No'  },
      ];
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1.5">{label}</p>
          <div className="flex gap-1.5">
            {opts.map(o => (
              <Chip key={o.v} active={(value ?? '') === o.v} onClick={() => set(o.v)}>{o.t}</Chip>
            ))}
          </div>
          {spec.help && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{spec.help}</p>}
        </div>
      );
    }

    // ── Multi-select — chips, dropdown nahi ───────────────────────────────
    // Dropdown me "car aur bike dono" karne ke liye khol-band karna padta hai.
    // Chips me dono ek nazar me dikhte hain ki kya-kya chuna hua hai.
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (v) => set(selected.includes(v)
        ? selected.filter(x => x !== v)
        : [...selected, v]);
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1.5">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {(spec.options || []).map(o => (
              <Chip key={o.value} active={selected.includes(o.value)} onClick={() => toggle(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
          {spec.help && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{spec.help}</p>}
        </div>
      );
    }

    case 'select':
      return (
        <Select
          label={spec.label}
          value={value ?? ''}
          onChange={set}
          size="sm"
          options={[{ value: '', label: 'Any' }, ...(spec.options || [])]}
        />
      );

    // ── Number range ──────────────────────────────────────────────────────
    case 'number_range': {
      const v = value || {};
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1.5">{label}</p>
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="decimal" placeholder="min"
                   value={v.min ?? ''} containerClassName="flex-1"
                   className="tabular-nums"
                   onChange={(e) => set({ ...v, min: e.target.value })} />
            <span className="text-ink-faint text-xs">to</span>
            <Input type="number" inputMode="decimal" placeholder="max"
                   value={v.max ?? ''} containerClassName="flex-1"
                   className="tabular-nums"
                   onChange={(e) => set({ ...v, max: e.target.value })} />
          </div>
          {spec.help && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{spec.help}</p>}
        </div>
      );
    }

    // ── Date range ────────────────────────────────────────────────────────
    case 'date_range': {
      const v = value || {};
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1.5">{label}</p>
          <div className="flex items-center gap-2">
            <Input type="date" value={v.from ?? ''} containerClassName="flex-1"
                   onChange={(e) => set({ ...v, from: e.target.value })} />
            <span className="text-ink-faint text-xs">to</span>
            <Input type="date" value={v.to ?? ''} containerClassName="flex-1"
                   onChange={(e) => set({ ...v, to: e.target.value })} />
          </div>
          <p className="text-[11px] text-ink-faint mt-1">Both days are included.</p>
        </div>
      );
    }

    // ── City — groups aur individual ids, dono saath ──────────────────────
    case 'city': {
      const v = value || {};
      const groups = Array.isArray(v.groups) ? v.groups : [];
      const toggleGroup = (g) => set({
        ...v,
        groups: groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g],
      });
      const ids = Array.isArray(v.ids) ? v.ids : [];
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1.5">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {cityGroups.map(g => (
              <Chip key={g.value} active={groups.includes(g.value)}
                    count={g.cityCount ?? undefined}
                    onClick={() => toggleGroup(g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
          <Input
            containerClassName="mt-2"
            placeholder="Or specific city IDs, comma separated — e.g. 108, 125"
            value={ids.join(', ')}
            onChange={(e) => set({
              ...v,
              ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite),
            })}
          />
          {(groups.length > 0 && ids.length > 0) && (
            <p className="text-[11px] text-ink-faint mt-1">
              Groups and individual cities are added together, not narrowed.
            </p>
          )}
          {spec.help && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{spec.help}</p>}
        </div>
      );
    }

    // ── text, aur koi bhi anjaan type ─────────────────────────────────────
    default:
      return (
        <Input
          label={spec.label}
          value={value ?? ''}
          onChange={(e) => set(e.target.value)}
          hint={spec.help}
          placeholder="Any"
        />
      );
  }
}

export { Chip };
