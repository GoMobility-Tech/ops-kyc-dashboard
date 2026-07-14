import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const TONES = {
  info:    { icon: Info,           style: 'bg-blue-50 border-blue-200 text-blue-800' },
  success: { icon: CheckCircle2,   style: 'bg-green-50 border-green-200 text-green-800' },
  warning: { icon: AlertTriangle,  style: 'bg-amber-50 border-amber-200 text-amber-800' },
  danger:  { icon: XCircle,        style: 'bg-red-50 border-red-200 text-red-700' },
};

export default function Alert({ tone = 'info', title, children, onClose, className = '' }) {
  const { icon: Icon, style } = TONES[tone];
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${style} ${className}`}>
      <Icon size={14} className="shrink-0 mt-0.5" />
      <div className="flex-1 leading-relaxed">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 text-base leading-none shrink-0" aria-label="Dismiss">×</button>
      )}
    </div>
  );
}
