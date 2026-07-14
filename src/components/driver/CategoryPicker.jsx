import React from 'react';
import { Spinner } from '../ui';

const SINGLE_CLASSES = new Set(['two_wheel', 'three_wheel']);

export function toggleCategory(current, type, master) {
  const meta = [
    ...(master.two_wheel   || []),
    ...(master.three_wheel || []),
    ...(master.car_side    || []),
  ].find(v => v.vehicle_type === type);
  if (!meta) return current;
  const already = current.includes(type);
  if (already) return current.filter(t => t !== type);
  if (SINGLE_CLASSES.has(meta.vehicle_class)) return [type];
  const carSideTypes = new Set((master.car_side || []).map(v => v.vehicle_type));
  return [...current.filter(t => carSideTypes.has(t)), type];
}

export default function CategoryPicker({ master, value, onChange, error }) {
  if (error) return null;
  if (!master) {
    return (
      <div className="bg-surface-soft border border-line rounded-lg p-2.5 text-ink-muted text-[11px] flex items-center gap-2">
        <Spinner size={11} /> Loading vehicle categories...
      </div>
    );
  }
  const sections = [
    { key: 'two_wheel',   label: '2-wheeler' },
    { key: 'three_wheel', label: '3-wheeler' },
    { key: 'car_side',    label: '4-wheeler' },
  ].filter(s => (master[s.key] || []).length > 0);

  return (
    <div className="bg-surface-soft rounded-lg border border-line p-2.5 space-y-2">
      <p className="text-ink-faint text-[10px] uppercase tracking-wider">
        Vehicle categories · optional (auto-detected from RC if skipped)
      </p>
      {sections.map(s => (
        <div key={s.key}>
          <p className="text-ink-muted text-[10px] mb-1">{s.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {master[s.key].map(v => {
              const on = value.includes(v.vehicle_type);
              return (
                <button
                  key={v.vehicle_type}
                  type="button"
                  onClick={() => onChange(toggleCategory(value, v.vehicle_type, master))}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition
                    ${on
                      ? 'bg-brand-100 text-brand-800 border-brand-600'
                      : 'bg-white text-ink-muted border-line hover:border-brand-500 hover:text-ink'}`}
                >
                  {v.display_name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-ink-faint text-[10px] leading-relaxed">
        2/3-wheeler is single-select. 4-wheeler allows multiple (e.g. Sedan + SUV + Luxury).
      </p>
    </div>
  );
}
