import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

export default function JsonViewer({ label, data, defaultOpen = false }) {
  const [open,   setOpen]   = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const empty = isEmpty(data);
  const pretty = empty ? '' : JSON.stringify(data, null, 2);

  const copy = async (e) => {
    e.stopPropagation();
    if (!pretty) return;
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="rounded-lg border border-line bg-surface-soft overflow-hidden">
      <button
        type="button"
        onClick={() => !empty && setOpen(o => !o)}
        disabled={empty}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${empty ? 'cursor-default opacity-60' : 'hover:bg-brand-100 transition'}`}
      >
        {empty
          ? <span className="w-3.5" />
          : open ? <ChevronDown size={13} className="text-ink-muted" /> : <ChevronRight size={13} className="text-ink-muted" />}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-navy">{label}</span>
        {empty
          ? <span className="text-[10px] text-ink-faint ml-1">— empty</span>
          : <span className="text-[10px] text-ink-faint ml-1">{Array.isArray(data) ? `[${data.length}]` : `{${Object.keys(data).length}}`}</span>}
        {!empty && (
          <button
            onClick={copy}
            className="ml-auto text-ink-faint hover:text-accent-navy transition p-0.5"
            title="Copy JSON"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </button>
      {open && !empty && (
        <pre className="text-[11px] leading-relaxed font-mono px-3 py-2 border-t border-line bg-accent-navy text-brand-400 overflow-x-auto max-h-80">
          {pretty}
        </pre>
      )}
    </div>
  );
}
