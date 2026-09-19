import React from 'react';
import { Input, Select } from '../../components/ui';
import MultiPicker from './MultiPicker.jsx';

// ─── Ek filter, uske type ke hisaab se ──────────────────────────────────────
//
// Kaunsa filter dikhega ye BACKEND tay karta hai. Ye file sirf itna jaanti hai
// ki `date_range` ka matlab do box hai aur `multiselect` ka matlab dropdown.
// Backend me naya filter add karne pe yahan kuch nahi badalta.
//
// ── Sab dropdown kyun ──
// Pehla version har boolean ko teen chips (Any/Yes/No) me dikhata tha aur har
// multiselect ko chips ki line me. Passengers pe 28 filters hain — screen itni
// lambi ho gayi thi ki neeche ka kuch dikhta hi nahi tha. Dropdown band rehta
// hai aur sirf chuna hua batata hai.
//
// Har anjaan type plain text box ban jaata hai, taaki backend kuch naya bheje
// to screen tooti nahi.

const ANY_YES_NO = [
  { value: '',      label: 'Any' },
  { value: 'true',  label: 'Yes' },
  { value: 'false', label: 'No'  },
];

export default function FilterField({ spec, value, onChange, cityGroups = [], cities = [] }) {
  const set = (v) => onChange(spec.key, v);
  const labelWithUnit = spec.unit ? `${spec.label} (${spec.unit})` : spec.label;

  switch (spec.type) {
    // ── Boolean — teen haal, do nahi ──────────────────────────────────────
    // "Any" filter na lagne ka matlab hai; wo "No" se alag baat hai.
    case 'boolean':
      return (
        <Select
          label={spec.label}
          value={value ?? ''}
          onChange={set}
          options={ANY_YES_NO}
          size="sm"
        />
      );

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

    case 'multiselect':
      return (
        <MultiPicker
          label={spec.label}
          hint={spec.help}
          options={spec.options || []}
          value={Array.isArray(value) ? value : []}
          onChange={set}
        />
      );

    // ── City — asli list backend se, groups sirf shortcut ─────────────────
    case 'city': {
      const v = value || {};
      const groups = Array.isArray(v.groups) ? v.groups : [];
      const ids    = Array.isArray(v.ids) ? v.ids : [];
      return (
        <MultiPicker
          label={spec.label}
          hint={groups.length && ids.length
            ? 'Groups and individual cities are added together, not narrowed.'
            : spec.help}
          options={cities}
          value={ids}
          onChange={(nextIds) => set({ ...v, ids: nextIds })}
          groups={cityGroups}
          activeGroups={groups}
          onGroupToggle={(g) => {
            if (g === null) { set({ ...v, groups: [] }); return; }
            set({
              ...v,
              groups: groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g],
            });
          }}
          placeholder="Any city"
        />
      );
    }

    case 'number_range': {
      const v = value || {};
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1">{labelWithUnit}</p>
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="decimal" placeholder="min"
                   value={v.min ?? ''} containerClassName="flex-1" className="tabular-nums"
                   onChange={(e) => set({ ...v, min: e.target.value })} />
            <span className="text-ink-faint text-xs">to</span>
            <Input type="number" inputMode="decimal" placeholder="max"
                   value={v.max ?? ''} containerClassName="flex-1" className="tabular-nums"
                   onChange={(e) => set({ ...v, max: e.target.value })} />
          </div>
          {spec.help && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{spec.help}</p>}
        </div>
      );
    }

    case 'date_range': {
      const v = value || {};
      return (
        <div>
          <p className="text-xs font-medium text-ink-muted mb-1">{spec.label}</p>
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
