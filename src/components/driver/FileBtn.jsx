import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

export default function FileBtn({ side, file, onChange }) {
  const ref = useRef();
  const openPicker = () => {
    if (!ref.current) return;
    ref.current.value = '';
    ref.current.click();
  };
  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className={`flex-1 flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border text-xs transition
          ${file
            ? 'border-brand-600 bg-brand-100 text-brand-800'
            : 'border-line bg-white text-ink-muted hover:border-brand-500 hover:text-ink'}`}
      >
        <Upload size={11} className="shrink-0" />
        <span className="truncate">
          {file ? file.name.slice(0, 14) + (file.name.length > 14 ? '…' : '') : side}
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
