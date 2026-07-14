import React, { useState } from 'react';
import { FileText, Eye } from 'lucide-react';

export default function DocThumb({ url, label }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (!url) return null;
  const isPdf = /\.pdf(\?|$)/i.test(url);

  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={open}
      title={`${label} · click to open`}
      className="group relative block w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-line bg-surface-soft hover:border-brand-500 transition"
    >
      {(isPdf || imgFailed) ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-ink-muted">
          <FileText size={20} />
          <span className="text-[10px] mt-1">{isPdf ? 'PDF' : 'No preview'}</span>
        </div>
      ) : (
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover pointer-events-none"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-accent-navy/80 text-white text-[10px] px-1.5 py-0.5 text-center opacity-0 group-hover:opacity-100 transition">
        {label} · open
      </div>
      <div className="absolute top-1 right-1 bg-accent-navy/80 rounded p-0.5 opacity-0 group-hover:opacity-100 transition">
        <Eye size={10} className="text-white" />
      </div>
    </button>
  );
}
