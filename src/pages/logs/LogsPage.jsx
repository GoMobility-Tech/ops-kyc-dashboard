import React, { useCallback, useEffect, useState } from 'react';
import {
  Filter, RefreshCw, ChevronDown, ChevronRight, ChevronUp, XCircle, ExternalLink, Bug, Clock,
} from 'lucide-react';
import { getApiLogs } from '../../api/opsApi.js';
import {
  Button, Input, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD, JsonViewer,
} from '../../components/ui';
import { useNavigate } from 'react-router-dom';

const KNOWN_MODULES = [
  'auth', 'rides', 'kyc', 'payments', 'wallet', 'subscriptions', 'admin', 'ops',
  'sos', 'coupons', 'support', 'notifications', 'tracking', 'zones', 'chat',
  'pricing', 'cities', 'logs',
];

const STATUS_FILTERS = [
  { key: '',      label: 'All' },
  { key: '2xx',   label: '2xx' },
  { key: '3xx',   label: '3xx' },
  { key: '4xx',   label: '4xx' },
  { key: '5xx',   label: '5xx' },
  { key: 'error', label: 'Errors only' },
];

function statusTone(code) {
  if (code == null) return 'neutral';
  const c = Math.floor(code / 100);
  if (c === 2) return 'success';
  if (c === 3) return 'info';
  if (c === 4) return 'warning';
  if (c === 5) return 'danger';
  return 'neutral';
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return iso; }
}

function DurationBar({ ms }) {
  if (ms == null) return <span className="text-ink-faint text-[11px]">—</span>;
  const slow = ms > 1000;
  const pct = Math.min(100, Math.max(4, (ms / 2000) * 100));
  const color = slow ? 'bg-red-500' : ms > 500 ? 'bg-amber-500' : 'bg-accent-green';
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1 bg-surface-alt rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] tabular-nums ${slow ? 'text-red-700 font-semibold' : 'text-ink-muted'}`}>
        {ms}ms
      </span>
    </div>
  );
}

function LogRow({ log, expanded, onToggle }) {
  const nav = useNavigate();
  const tone = statusTone(log.status_code);

  return (
    <>
      <TR onClick={onToggle}>
        <TD className="whitespace-nowrap">
          <span className="text-[11px] text-ink-muted font-mono">{fmtTime(log.created_at)}</span>
        </TD>
        <TD>
          <span className="inline-block px-1.5 py-0.5 rounded bg-accent-navy text-brand-400 text-[10px] font-mono font-bold">
            {log.method}
          </span>
        </TD>
        <TD>
          <p className="text-xs font-mono text-ink truncate max-w-[380px]" title={log.path}>{log.path}</p>
          {log.module && (
            <p className="text-[10px] text-ink-faint mt-0.5">module: {log.module}</p>
          )}
        </TD>
        <TD>
          <Badge tone={tone}>
            {log.status_code ?? '—'}{log.is_error ? ' · err' : ''}
          </Badge>
        </TD>
        <TD>
          <DurationBar ms={log.duration_ms} />
        </TD>
        <TD className="max-w-[160px]">
          {log.user_id ? (
            <button
              onClick={(e) => { e.stopPropagation(); nav(`/all-drivers/${log.user_id}`); }}
              className="text-[11px] font-mono text-accent-navy hover:underline truncate max-w-[140px] inline-flex items-center gap-1"
              title={log.user_id}
            >
              {log.user_id.slice(0, 8)}…
              <ExternalLink size={10} />
            </button>
          ) : (
            <span className="text-[11px] text-ink-faint">—</span>
          )}
        </TD>
        <TD align="right">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] text-accent-navy hover:bg-brand-100 transition"
          >
            {expanded ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Details</>}
          </button>
        </TD>
      </TR>
      {expanded && (
        <tr className="bg-brand-100/60">
          <td colSpan={7} className="px-4 py-3">
            <div className="space-y-2">
              {log.is_error && log.error_message && (
                <Alert tone="danger" title="Error message">{log.error_message}</Alert>
              )}
              {(log.ip_address || log.user_agent) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {log.ip_address && (
                    <div className="bg-surface-soft border border-line rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-ink-faint">IP</p>
                      <p className="font-mono text-ink">{log.ip_address}</p>
                    </div>
                  )}
                  {log.user_agent && (
                    <div className="bg-surface-soft border border-line rounded-lg px-3 py-2 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-ink-faint">User Agent</p>
                      <p className="font-mono text-ink text-[10px] truncate" title={log.user_agent}>{log.user_agent}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <JsonViewer label="Request Params" data={log.request_params} />
                <JsonViewer label="Request Query"  data={log.request_query} />
                <JsonViewer label="Request Body"   data={log.request_body} defaultOpen />
                <JsonViewer label="Response Body"  data={log.response_body} defaultOpen />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsPage() {
  const [module, setModule] = useState('');
  const [path,   setPath]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [logs, setLogs]           = useState([]);
  const [cursor, setCursor]       = useState(null);
  const [done, setDone]           = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [applying, setApplying]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState(null);

  const fetchPage = useCallback(async (nextCursor = null, opts = {}) => {
    const isFirst = !nextCursor;
    const origin  = opts.origin || 'load';
    if (isFirst) {
      if (origin === 'refresh') setRefreshing(true);
      else if (origin === 'apply' || origin === 'reset') setApplying(true);
      // origin === 'load' → initial page load; initialLoad already true, don't flip a busy flag
    } else {
      setLoadingMore(true);
    }
    setError('');
    try {
      const res = await getApiLogs({
        type: 1,
        limit: 100,
        module: opts.module ?? (module || undefined),
        path:   opts.path   ?? (path   || undefined),
        beforeCreatedAt: nextCursor || undefined,
      });
      const data = res.data?.data || {};
      const items = data.logs || [];
      setLogs(prev => isFirst ? items : [...prev, ...items]);
      setCursor(data.nextBeforeCreatedAt || null);
      setDone(data.nextBeforeCreatedAt == null);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) setError('Access denied. You need admin / super_admin / ops_team role.');
      else setError(err.response?.data?.message || 'Failed to load logs');
    } finally {
      setInitialLoad(false);
      setApplying(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [module, path]);

  useEffect(() => { fetchPage(null); /* eslint-disable-next-line */ }, []);

  const applyFilters = (e) => {
    e?.preventDefault();
    setExpanded(null);
    fetchPage(null, { origin: 'apply' });
  };

  const resetFilters = () => {
    setModule(''); setPath(''); setStatusFilter('');
    setExpanded(null);
    fetchPage(null, { origin: 'reset', module: undefined, path: undefined });
  };

  const handleRefresh = () => {
    setExpanded(null);
    fetchPage(null, { origin: 'refresh' });
  };

  // Client-side status filter
  const visibleLogs = logs.filter(l => {
    if (!statusFilter) return true;
    if (statusFilter === 'error') return l.is_error;
    const bucket = Math.floor((l.status_code || 0) / 100);
    return statusFilter === `${bucket}xx`;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">API Logs</h2>
          <p className="text-xs text-ink-muted mt-0.5">Live request logs — filter, expand, inspect payloads</p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleRefresh} loading={refreshing}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card padding="sm">
        <form onSubmit={applyFilters} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-3">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted mb-1">Module</label>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="w-full bg-white rounded-lg px-3 py-2 text-sm text-ink border border-line focus:border-accent-navy outline-none"
            >
              <option value="">All modules</option>
              {KNOWN_MODULES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <Input
              label="Path (partial match)"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/verify-signin, /kyc/admin, /ops/me…"
            />
          </div>

          <div className="sm:col-span-4 flex items-end gap-2">
            <Button type="submit" icon={Filter} loading={applying}>Apply</Button>
            <Button type="button" variant="outline" icon={XCircle} onClick={resetFilters} loading={applying}>Reset</Button>
          </div>
        </form>

        <div className="flex gap-1.5 mt-3 pt-3 border-t border-line overflow-x-auto">
          {STATUS_FILTERS.map(f => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key || 'all'}
                onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                  ${active
                    ? 'bg-accent-navy text-white border-accent-navy'
                    : 'bg-surface-soft text-ink-muted border-line hover:border-accent-navy hover:text-accent-navy'}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {initialLoad ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : visibleLogs.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="No logs match"
          description={logs.length === 0 ? 'No logs found for these filters' : 'All logs filtered out by status filter'}
        />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1 flex items-center gap-2">
            <Clock size={12} /> Showing {visibleLogs.length}{visibleLogs.length !== logs.length ? ` of ${logs.length} loaded` : ''}
            {done && ' · end of stream'}
          </p>
          <Table>
            <THead>
              <tr>
                <TH>Time</TH>
                <TH>Method</TH>
                <TH>Path</TH>
                <TH>Status</TH>
                <TH>Duration</TH>
                <TH>User</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {visibleLogs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  expanded={expanded === log.id}
                  onToggle={() => setExpanded(x => x === log.id ? null : log.id)}
                />
              ))}
            </TBody>
          </Table>

          {!done && (
            <Button
              variant="outline"
              className="w-full"
              icon={ChevronDown}
              loading={loadingMore}
              onClick={() => fetchPage(cursor)}
            >
              Load more (older)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
