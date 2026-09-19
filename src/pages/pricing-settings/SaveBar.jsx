import React from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Button, Badge } from '../../components/ui';

// The row of controls under every editable section.
//
// It stays disabled until something actually changed. That is not politeness —
// an empty patch is a request the backend rejects, and more importantly a save
// button that is always live invites a reflex press on a screen where every
// press changes what riders are charged on the next quote.
export default function SaveBar({ changedCount, saving, onSave, onReset, children }) {
  const dirty = changedCount > 0;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
      <div className="flex items-center gap-2 min-w-0">
        {dirty
          ? <Badge tone="warning">{changedCount} unsaved {changedCount === 1 ? 'change' : 'changes'}</Badge>
          : <span className="text-[11px] text-ink-faint">No changes</span>}
        {children}
      </div>
      <div className="flex items-center gap-2">
        {dirty && (
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} disabled={saving}>
            Undo
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          icon={Save}
          onClick={onSave}
          loading={saving}
          disabled={!dirty}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
