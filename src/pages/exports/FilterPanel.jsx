import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronRight, Calculator, Play, Eraser } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import FilterField from './FilterField.jsx';
import { countFilters, fmtCount } from './exportMeta.js';

// ─── Filter panel ───────────────────────────────────────────────────────────
//
// Poora panel ek hi cheez hai jo khulti-bandh hoti hai, aur uska header hi
// action bar hai.
//
// Wajah: is screen ka asli kaam exports ki table hai — "meri file bani ya
// nahi, download karun". 28 filters hamesha khule rahein to table screen se
// neeche chali jaati hai. Filters zaroorat pe kholo, kaam khatam, band.
//
// Header hamesha batata hai kitne filter lage hain, to band hone pe bhi pata
// rehta hai ki kuch laga hua hai.

function Section({ section, draft, onChange, cityGroups, cities, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const active = section.filters.filter(f => countFilters({ [f.key]: draft[f.key] }) > 0).length;

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-alt transition"
      >
        {open ? <ChevronDown size={13} className="text-ink-faint shrink-0" />
              : <ChevronRight size={13} className="text-ink-faint shrink-0" />}
        <span className="text-xs font-semibold text-ink flex-1">{section.label}</span>
        {active > 0 && (
          <span className="text-[11px] font-semibold text-accent-navy tabular-nums">
            {active} set
          </span>
        )}
        <span className="text-[11px] text-ink-faint tabular-nums">{section.filters.length}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-3.5">
          {section.filters.map(f => (
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
    </div>
  );
}

export default function FilterPanel({
  dataset, draft, onChange, onClear, catalog,
  preview, busy, onCount, onBuild,
}) {
  const [open, setOpen] = useState(true);
  if (!dataset) return null;

  const applied = countFilters(draft);

  return (
    <Card padding="none" className="overflow-visible">
      {/* Toolbar — panel band ho tab bhi yahi dikhta hai */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <SlidersHorizontal size={14} className="text-accent-navy shrink-0" />
          <span className="text-sm font-semibold text-ink">Filters</span>
          <span className="text-[11px] text-ink-muted tabular-nums">
            {applied > 0 ? `${applied} applied` : `none of ${dataset.filterCount}`}
          </span>
          {open ? <ChevronDown size={13} className="text-ink-faint" />
                : <ChevronRight size={13} className="text-ink-faint" />}
        </button>

        <div className="flex-1" />

        {preview && (
          <span className="text-xs text-ink-muted">
            <strong className="text-accent-navy tabular-nums">{fmtCount(preview.rowCount)}</strong> rows
            {preview.rowCount === 0 && <span className="text-red-600"> — nothing to export</span>}
          </span>
        )}

        {applied > 0 && (
          <Button variant="ghost" size="sm" icon={Eraser} onClick={onClear}>Clear</Button>
        )}
        <Button variant="outline" size="sm" icon={Calculator}
                loading={busy === 'preview'} onClick={onCount}>
          Count rows
        </Button>
        <Button variant="primary" size="sm" icon={Play}
                loading={busy === 'create'}
                disabled={preview?.rowCount === 0}
                onClick={onBuild}>
          Build Excel
        </Button>
      </div>

      {/* Kaunse filter lage hain — text me, chips me nahi */}
      {preview?.filterSummary?.length > 0 && (
        <p className="px-4 pb-3 -mt-1 text-[11px] text-ink-faint leading-relaxed">
          {preview.filterSummary.join('  ·  ')}
        </p>
      )}

      {open && dataset.filterGroups.map((g, i) => (
        <Section
          key={g.label}
          section={g}
          draft={draft}
          onChange={onChange}
          cityGroups={catalog?.cityGroups || []}
          cities={catalog?.cities || []}
          defaultOpen={i === 0}
        />
      ))}
    </Card>
  );
}
