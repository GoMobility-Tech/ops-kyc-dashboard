import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="text-center py-10 px-4 space-y-3">
      <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mx-auto">
        <Icon size={22} />
      </div>
      <div>
        {title && <p className="text-ink font-medium text-sm">{title}</p>}
        {description && <p className="text-ink-muted text-xs mt-1 leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}
