import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { EXTRACT_FIELDS } from './constants.js';

export default function ExtractedDataPanel({ docType, data, score, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!data) return null;
  const fields = EXTRACT_FIELDS[docType] || {};
  const entries = Object.entries(fields).filter(([k]) => data[k] != null && data[k] !== '');
  if (!entries.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-accent-navy hover:text-accent-navyMid font-semibold transition mt-1"
      >
        <FileText size={11} />
        <span>Extracted data{score != null ? ` · ${score}%` : ''}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 bg-brand-100 rounded-lg border border-brand-400 p-3">
          {entries.map(([k, label]) => (
            <div key={k}>
              <p className="text-brand-800 text-[10px] uppercase tracking-wider font-semibold">{label}</p>
              <p className="text-ink text-xs font-medium break-words leading-snug">{String(data[k])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
