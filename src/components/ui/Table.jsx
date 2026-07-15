import React from 'react';

export function Table({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-line bg-surface-soft shadow-card ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-accent-navy text-brand-400 text-[10px] uppercase tracking-wider">
      {children}
    </thead>
  );
}

export function TH({ children, className = '', align = 'left' }) {
  return (
    <th className={`px-3 py-2.5 font-semibold text-${align} whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ children, onClick, className = '', hover = true }) {
  return (
    <tr
      onClick={onClick}
      className={`bg-surface-soft ${hover ? 'hover:bg-brand-100 transition' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className = '', align = 'left' }) {
  return (
    <td className={`px-3 py-3 align-middle text-${align} ${className}`}>
      {children}
    </td>
  );
}
