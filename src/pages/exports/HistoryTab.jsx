import React, { useState } from 'react';
import {
  Download, RefreshCw, ChevronLeft, ChevronRight, Globe, Monitor,
  FileSpreadsheet, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  Card, Badge, Button, Select, Alert, Spinner, EmptyState,
  Table, THead, TBody, TH, TR, TD,
} from '../../components/ui';
import { getExportDownloadUrl } from '../../api/opsApi.js';
import {
  STATUS_TONE, STATUS_LABEL, fmtWhen, fmtBytes, fmtCount, triggerDownload,
} from './exportMeta.js';

// Device string 200 characters ka hota hai. Screen pe "Chrome · Mac" kaafi hai;
// poora string hover pe milta hai.
const shortDevice = (ua) => {
  if (!ua) return null;
  const os = /Windows NT/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux' : null;
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : null;
  return [br, os].filter(Boolean).join(' · ') || ua.slice(0, 24);
};

// Kaunse filter lage the — job row me stored hain, to purani file kholne se
// pehle hi pata chal jaata hai ki usme kya hai.
function FilterSummary({ filters }) {
  const keys = Object.keys(filters || {});
  if (!keys.length) return <span className="text-[11px] text-ink-faint italic">No filters — full dataset</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[280px]">
      {keys.slice(0, 4).map(k => <Badge key={k} tone="neutral">{k}</Badge>)}
      {keys.length > 4 && <Badge tone="neutral">+{keys.length - 4}</Badge>}
    </div>
  );
}

function ExportRow({ row, onError, onDownloaded }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      // Link har baar naya banta hai (15 min ka), isliye purani file bhi aaj
      // download ho jaati hai. Ye call download count bhi badhata hai.
      const res = await getExportDownloadUrl(row.id);
      const data = res.data?.data;
      if (!data?.url) throw new Error('No link came back');
      triggerDownload(data.url);
      onDownloaded(data.downloadCount);
    } catch (err) {
      onError(err.response?.data?.message || err.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const building = row.status === 'queued' || row.status === 'running';

  return (
    <TR>
      <TD>
        <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
          {fmtWhen(row.created_at)}
        </span>
      </TD>

      <TD>
        <Badge tone="brand">{row.dataset}</Badge>
        <div className="mt-1"><FilterSummary filters={row.filters} /></div>
      </TD>

      <TD>
        <Badge tone={STATUS_TONE[row.status] || 'neutral'}
               icon={building ? Loader2 : row.status === 'failed' ? AlertTriangle : undefined}>
          {STATUS_LABEL[row.status] || row.status}
        </Badge>
        {row.status === 'failed' && row.error_message && (
          <p className="text-[11px] text-red-600 mt-1 max-w-[240px] leading-relaxed">
            {row.error_message}
          </p>
        )}
        {row.status === 'ready' && (
          <p className="text-[11px] text-ink-muted mt-1 tabular-nums">
            {fmtCount(row.row_count)} rows · {fmtBytes(row.file_size_bytes)}
          </p>
        )}
      </TD>

      <TD>
        <span className="text-[11px] text-ink truncate max-w-[170px] block">
          {row.requested_by_email || '—'}
        </span>
        {(row.ip_address || row.user_agent) ? (
          <div className="mt-0.5 space-y-0.5">
            {row.ip_address && (
              <span className="flex items-center gap-1 text-[11px] text-ink-muted tabular-nums">
                <Globe size={9} className="text-ink-faint shrink-0" />{row.ip_address}
              </span>
            )}
            {row.user_agent && (
              <span className="flex items-center gap-1 text-[11px] text-ink-muted" title={row.user_agent}>
                <Monitor size={9} className="text-ink-faint shrink-0" />{shortDevice(row.user_agent)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-ink-faint italic">origin not recorded</span>
        )}
      </TD>

      <TD>
        <span className="text-sm font-bold text-accent-navy tabular-nums">
          {row.download_count ?? 0}
        </span>
        {row.last_downloaded_at && (
          <p className="text-[10px] text-ink-faint mt-0.5">{fmtWhen(row.last_downloaded_at)}</p>
        )}
      </TD>

      <TD align="right">
        {row.status === 'ready' ? (
          <Button variant="primary" size="sm" icon={Download} loading={busy} onClick={download}>
            Download
          </Button>
        ) : building ? (
          <span className="text-[11px] text-ink-faint">Building…</span>
        ) : (
          <span className="text-[11px] text-ink-faint">—</span>
        )}
      </TD>
    </TR>
  );
}

export default function HistoryTab({
  rows, pagination, loading, datasets,
  filters, onFilterChange, onPage, onRefresh, onError, onDownloaded,
}) {
  const { total = 0, limit = 20, offset = 0 } = pagination || {};
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const building = rows.some(r => r.status === 'queued' || r.status === 'running');

  return (
    <div className="space-y-3">
      <Alert tone="info">
        Every export ever requested, newest first. Files do not expire — a sheet built
        months ago still downloads today, and every download is counted.
      </Alert>

      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={filters.dataset || ''}
          onChange={(v) => onFilterChange({ ...filters, dataset: v })}
          options={[{ value: '', label: 'All datasets' },
                    ...(datasets || []).map(d => ({ value: d.key, label: d.label }))]}
          size="sm" className="w-44"
        />
        <Select
          value={filters.status || ''}
          onChange={(v) => onFilterChange({ ...filters, status: v })}
          options={[
            { value: '', label: 'Any status' },
            { value: 'queued', label: 'Queued' },
            { value: 'running', label: 'Building' },
            { value: 'ready', label: 'Ready' },
            { value: 'failed', label: 'Failed' },
          ]}
          size="sm" className="w-40"
        />
        <Select
          value={filters.mine ? 'mine' : ''}
          onChange={(v) => onFilterChange({ ...filters, mine: v === 'mine' })}
          options={[{ value: '', label: 'Everyone' }, { value: 'mine', label: 'Only mine' }]}
          size="sm" className="w-36"
        />
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRefresh}>Refresh</Button>
        {building && (
          <span className="text-[11px] text-ink-muted">Refreshing on its own while a file is building</span>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No exports yet"
          description="Build one from the New export tab and it will show up here."
        />
      ) : (
        <>
          <Card padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Requested</TH>
                  <TH>What</TH>
                  <TH>Status</TH>
                  <TH>By / from where</TH>
                  <TH>Downloads</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(r => (
                  <ExportRow key={r.id} row={r} onError={onError} onDownloaded={onDownloaded} />
                ))}
              </TBody>
            </Table>
          </Card>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-ink-muted tabular-nums">
              {offset + 1}–{Math.min(offset + limit, total)} of {fmtCount(total)}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" icon={ChevronLeft}
                      disabled={offset === 0} onClick={() => onPage(offset - limit)}>
                Prev
              </Button>
              <span className="text-[11px] text-ink-muted tabular-nums">Page {page} / {pages}</span>
              <Button variant="outline" size="sm" iconRight={ChevronRight}
                      disabled={offset + limit >= total} onClick={() => onPage(offset + limit)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
