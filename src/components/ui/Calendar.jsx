import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const iso = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseIso = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const sameDay = (a, b) => a && b && iso(a) === iso(b);
const inRange = (d, from, to) => {
  if (!from || !to) return false;
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
};

/**
 * Range calendar — single-month grid with prev/next month nav.
 * Click 1: set `from`, clears `to`. Click 2: sets `to` (auto-swaps if before from).
 *
 * Props: from, to (ISO strings), onChange({ from, to })
 */
export default function Calendar({ from, to, onChange, minYear = 2020 }) {
  const fromD = parseIso(from);
  const toD   = parseIso(to);
  const initialCursor = fromD || new Date();
  const [cursor, setCursor] = useState(new Date(initialCursor.getFullYear(), initialCursor.getMonth(), 1));
  const [hover, setHover]   = useState(null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  // Build grid — Monday first
  const firstOfMonth = new Date(y, m, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mon..6=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  const prev = () => setCursor(new Date(y, m - 1, 1));
  const next = () => setCursor(new Date(y, m + 1, 1));

  const pick = (d) => {
    if (!fromD || (fromD && toD)) {
      // Start new range
      onChange({ from: iso(d), to: '' });
    } else {
      // Second click — set to; swap if needed
      if (d < fromD) onChange({ from: iso(d), to: iso(fromD) });
      else           onChange({ from: iso(fromD), to: iso(d) });
    }
  };

  const today = new Date();

  return (
    <div className="bg-white rounded-lg border border-line p-3 select-none w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prev}
          className="p-1 rounded-md hover:bg-brand-100 text-accent-navy transition"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-semibold text-accent-navy">
          {MONTHS[m]} {y}
        </div>
        <button
          type="button"
          onClick={next}
          className="p-1 rounded-md hover:bg-brand-100 text-accent-navy transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-ink-faint text-center mb-1">
        {DAYS.map(d => <div key={d} className="py-1 font-semibold">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-8" />;
          const isFrom  = sameDay(d, fromD);
          const isTo    = sameDay(d, toD);
          const isToday = sameDay(d, today);
          const inSel   = inRange(d, fromD, toD);
          const inHover = fromD && !toD && hover &&
            inRange(d, fromD < hover ? fromD : hover, fromD < hover ? hover : fromD);

          const base = 'h-8 text-xs flex items-center justify-center transition cursor-pointer';
          let cls = 'text-ink hover:bg-brand-100 rounded-md';
          if (inSel || inHover) cls = 'bg-brand-100 text-accent-navy rounded-none';
          if (isFrom) cls = 'bg-accent-navy text-white rounded-l-md font-semibold';
          if (isTo)   cls = 'bg-accent-navy text-white rounded-r-md font-semibold';
          if (isFrom && (isTo || !toD)) cls = 'bg-accent-navy text-white rounded-md font-semibold';
          if (isToday && !isFrom && !isTo) cls += ' ring-1 ring-brand-500';

          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
              className={`${base} ${cls}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
