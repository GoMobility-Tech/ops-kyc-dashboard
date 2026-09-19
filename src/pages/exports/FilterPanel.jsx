import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eraser } from 'lucide-react';
import { Card, Badge, Button } from '../../components/ui';
import FilterField from './FilterField.jsx';
import { countFilters } from './exportMeta.js';

// Filter groups collapsible hain. Passengers pe 28 filters hain aur ek saath
// khole to jobs table screen se neeche chali jaati hai — jabki wahi cheez hai
// jo user sabse zyada dekhta hai. Pehla group khula rehta hai, baaki band.
function Group({ group, draft, onChange, cityGroups, cities, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const active = group.filters.filter(f => countFilters({ [f.key]: draft[f.key] }) > 0).length;

  return (
    <Card padding="none" className="overflow-visible">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-alt transition"
      >
        {open ? <ChevronDown size={14} className="text-ink-faint shrink-0" />
              : <ChevronRight size={14} className="text-ink-faint shrink-0" />}
        <span className="text-xs font-bold text-accent-navy uppercase tracking-wider flex-1">
          {group.label}
        </span>
        {active > 0 && <Badge tone="brand">{active}</Badge>}
        <span className="text-[11px] text-ink-faint">{group.filters.length}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-line
                        grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {group.filters.map(f => (
            <FilterField
              key={f.key}
              spec={f}
              value={draft[f.key]}
              onChange={onChange}
              cityGroups={cityGroups}
              cities={cities}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function FilterPanel({ dataset, draft, onChange, onClear, catalog }) {
  if (!dataset) return null;
  const applied = countFilters(draft);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
          {dataset.description}
        </p>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{dataset.filterCount} filters</Badge>
          <Badge tone="neutral">{dataset.columnCount} columns</Badge>
          {applied > 0 && (
            <Button variant="ghost" size="sm" icon={Eraser} onClick={onClear}>Clear all</Button>
          )}
        </div>
      </div>

      {dataset.filterGroups.map((g, i) => (
        <Group
          key={g.label}
          group={g}
          draft={draft}
          onChange={onChange}
          cityGroups={catalog?.cityGroups || []}
          cities={catalog?.cities || []}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
