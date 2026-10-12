import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { Badge } from '../../../components/ui';
import Segmented from './Segmented.jsx';
import { SCOPE_LABEL } from './slabModel.js';

const field = 'w-full bg-white rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20';

// "Where does this set apply?" — all cities, one state, or any number of cities.
//
// Rule resolution at ride time is city > state > all cities, so a city set
// always beats a state set, which beats the all-cities set. The hint under the
// switch says that, because it is the thing people get wrong.
export default function ScopePicker({
  scopes, scopeType, onScopeType, stateId, onStateId, cityIds, onCityIds, disabled = false,
}) {
  const [q, setQ] = useState('');

  const cities = scopes?.cities || [];
  const states = scopes?.states || [];

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? cities.filter(c => c.name.toLowerCase().includes(needle) || c.state_name.toLowerCase().includes(needle))
      : cities;
    return list.slice(0, 40);
  }, [cities, q]);

  const byId = useMemo(() => new Map(cities.map(c => [c.id, c])), [cities]);
  const toggle = (id) => onCityIds(cityIds.includes(id) ? cityIds.filter(x => x !== id) : [...cityIds, id]);

  return (
    <div className="space-y-2">
      <Segmented
        label="Applies to"
        value={scopeType}
        onChange={onScopeType}
        disabled={disabled}
        options={[
          { value: 'city',   label: 'Cities', hint: 'Only the cities you pick' },
          { value: 'state',  label: 'A state', hint: 'Every city of one state that has no city set of its own' },
          { value: 'global', label: 'All cities', hint: 'Everywhere that has no city or state set' },
        ]}
      />

      {scopeType === 'global' && (
        <p className="text-[11px] text-ink-faint leading-relaxed">
          Applies in every city that has no set of its own. Be careful: this changes fares across the whole country.
        </p>
      )}

      {scopeType === 'state' && (
        <select className={field} value={stateId ?? ''} disabled={disabled}
                onChange={e => onStateId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a state…</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {scopeType === 'city' && (
        <div className="space-y-2">
          {cityIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cityIds.map(id => {
                const c = byId.get(id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 text-xs bg-brand-100 text-brand-800 border border-brand-400 rounded-full pl-2.5 pr-1 py-0.5 font-medium">
                    {c ? c.name : `City ${id}`}
                    {!disabled && (
                      <button type="button" onClick={() => toggle(id)} className="p-0.5 rounded-full hover:bg-brand-400/40" aria-label={`Remove ${c?.name || id}`}>
                        <X size={11} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {!disabled && (
            <>
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-line focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/20">
                <Search size={14} className="text-ink-faint shrink-0" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a city or state…"
                       className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint min-w-0" />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-line bg-white divide-y divide-line-soft">
                {matches.length === 0 && <p className="px-3 py-3 text-xs text-ink-faint">No city matches.</p>}
                {matches.map(c => {
                  const on = cityIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-brand-100 ${on ? 'bg-brand-100/60' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="accent-accent-navy" />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-[11px] text-ink-faint truncate">{c.state_name}</span>
                      {c.is_active && <Badge tone="success">Live</Badge>}
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[11px] text-ink-faint leading-relaxed">
            One set is saved per city, all with the same slabs. A city set always wins over a state or all-cities set.
          </p>
        </div>
      )}
    </div>
  );
}

export const scopeSummary = (set) => (set.scope === 'global'
  ? SCOPE_LABEL.global
  : `${set.scope_name || `${SCOPE_LABEL[set.scope]} ${set.scope_id}`}`);
