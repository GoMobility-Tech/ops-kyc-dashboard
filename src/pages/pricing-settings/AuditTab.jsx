import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History, RefreshCw, ArrowRight, Monitor, Globe, User, Search,
} from 'lucide-react';
import {
  Alert, Card, Badge, Button, Select, Input, Spinner, EmptyState, StatTile,
  Table, THead, TBody, TH, TR, TD,
} from '../../components/ui';
import { getPricingAudit } from '../../api/opsApi.js';
import { AUDIT_SCOPES, fmtWhen } from './pricingMeta.js';

// ─── Change history ─────────────────────────────────────────────────────────
//
// The tab that answers "who changed the fare, when, and from where". It is the
// first thing anyone asks when a number looks wrong, so it carries the whole
// story on one row rather than making someone join it against api_logs by
// hand: who, when, which setting, the exact before and after, the IP and the
// device.
//
// Two things it deliberately does not hide:
//
//   • Changes made straight in the database leave no row here. Nothing records
//     them, so the tab says so rather than implying the list is complete.
//   • Rows written before Migration 128 have no origin. They show "not
//     recorded" instead of a blank cell, because a blank reads like "nobody"
//     rather than "never captured".

// A device string is 200 characters of noise. What matters on this screen is
// which machine, roughly — enough to recognise "that was not me".
const shortDevice = (ua) => {
  if (!ua) return null;
  const os =
    /Windows NT/.test(ua)        ? 'Windows' :
    /Mac OS X/.test(ua)          ? 'Mac'     :
    /Android/.test(ua)           ? 'Android' :
    /iPhone|iPad|iOS/.test(ua)   ? 'iOS'     :
    /Linux/.test(ua)             ? 'Linux'   : null;
  const browser =
    /Edg\//.test(ua)             ? 'Edge'    :
    /OPR\/|Opera/.test(ua)       ? 'Opera'   :
    /Chrome\//.test(ua)          ? 'Chrome'  :
    /Firefox\//.test(ua)         ? 'Firefox' :
    /Safari\//.test(ua)          ? 'Safari'  : null;
  if (!os && !browser) return ua.slice(0, 28);
  return [browser, os].filter(Boolean).join(' · ');
};

export function OriginCell({ row }) {
  // Written before the origin columns existed, or changed by a script.
  if (!row.ip_address && !row.user_agent) {
    return <span className="text-[11px] text-ink-faint italic">not recorded</span>;
  }
  const device = shortDevice(row.user_agent);
  return (
    <div className="space-y-0.5">
      {row.ip_address && (
        <span className="flex items-center gap-1 text-[11px] text-ink tabular-nums">
          <Globe size={9} className="text-ink-faint shrink-0" />{row.ip_address}
        </span>
      )}
      {device && (
        <span className="flex items-center gap-1 text-[11px] text-ink-muted" title={row.user_agent}>
          <Monitor size={9} className="text-ink-faint shrink-0" />{device}
        </span>
      )}
    </div>
  );
}

export function ChangeCell({ row }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums flex-wrap">
      <span className="text-ink-muted line-through">{row.old_value ?? '—'}</span>
      <ArrowRight size={10} className="text-ink-faint shrink-0" />
      <span className="text-ink font-semibold">{row.new_value ?? '—'}</span>
    </span>
  );
}

export default function AuditTab() {
  const [rows, setRows]       = useState([]);
  const [scope, setScope]     = useState('');
  const [who, setWho]         = useState('');
  const [q, setQ]             = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPricingAudit({ scope: scope || undefined, limit: 500 });
      setRows(res.data?.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the change history');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const editors = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      const key = r.changed_by_email || r.changed_by || 'unknown';
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [
      { value: '', label: 'Everyone' },
      ...[...seen.entries()].map(([k, n]) => ({ value: k, label: `${k} (${n})` })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (who && (r.changed_by_email || r.changed_by || 'unknown') !== who) return false;
      if (!needle) return true;
      return [r.target, r.field, r.old_value, r.new_value, r.ip_address]
        .some(v => String(v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, who, q]);

  const editorCount = editors.length - 1;
  const lastChange  = rows[0]?.changed_at;

  return (
    <div className="space-y-3">
      <Alert tone="info">
        Every pricing change made through this screen, newest first — who made it, when,
        and from where. Changes made straight in the database do not appear here;
        nothing records those.
      </Alert>

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatTile label="Changes" value={rows.length} icon={History} />
          <StatTile label="People" value={editorCount} icon={User} />
          <StatTile label="Last change" value={fmtWhen(lastChange)} icon={RefreshCw} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a setting, value or IP…"
          containerClassName="flex-1 min-w-[200px]"
        />
        <Select value={scope} onChange={setScope} options={AUDIT_SCOPES} size="sm" className="w-44" />
        <Select value={who} onChange={setWho} options={editors} size="sm" className="w-56" />
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={rows.length === 0 ? 'Nothing recorded yet' : 'Nothing matches'}
          description={rows.length === 0
            ? 'No pricing change has been made through the dashboard. Anything changed directly in the database leaves no trace here.'
            : 'Try a different search, person or section.'}
        />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>What</TH>
                <TH>Change</TH>
                <TH>From where</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map(r => (
                <TR key={r.id}>
                  <TD>
                    <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
                      {fmtWhen(r.changed_at)}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-[11px] text-ink truncate max-w-[190px] block"
                          title={r.changed_by || ''}>
                      {r.changed_by_email || (r.changed_by ? `user ${String(r.changed_by).slice(0, 8)}` : '—')}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone="neutral">{r.scope}</Badge>
                      <span className="text-[11px] text-ink font-medium">{r.target}</span>
                    </div>
                    <span className="text-[11px] text-ink-faint font-mono">{r.field}</span>
                  </TD>
                  <TD><ChangeCell row={r} /></TD>
                  <TD><OriginCell row={r} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
