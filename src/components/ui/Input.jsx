import React from 'react';

export default function Input({
  label,
  hint,
  error,
  icon: Icon,
  suffix,
  className = '',
  containerClassName = '',
  ...rest
}) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-xs font-medium text-ink-muted mb-1">
          {label}
        </label>
      )}
      <div className={`flex items-center gap-2 bg-white rounded-lg px-3 py-2 border transition
        ${error ? 'border-red-400 focus-within:border-red-500'
                : 'border-line focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/20'}`}>
        {Icon && <Icon size={14} className="text-ink-faint shrink-0" />}
        <input
          {...rest}
          className={`flex-1 bg-transparent text-ink text-sm outline-none placeholder:text-ink-faint min-w-0 ${className}`}
        />
        {suffix}
      </div>
      {error
        ? <p className="text-xs text-red-600 mt-1 leading-relaxed">{error}</p>
        : hint && <p className="text-[11px] text-ink-faint mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}
