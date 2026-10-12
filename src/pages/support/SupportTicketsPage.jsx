import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, MessageCircle, Send, Paperclip, X as XIcon, FileText,
  Clock, Loader2, Hourglass, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import {
  getSupportStats, getSupportTickets, getSupportTicket,
  updateSupportTicket, replySupportTicket, uploadSupportAttachments,
} from '../../api/opsApi.js';
import useUrlFilters from '../../utils/useUrlFilters.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert, StatTile,
  Table, THead, TBody, TH, TR, TD, Select, SearchBar, Modal, ImageLightbox,
} from '../../components/ui';

const isImageUrl = (url) => /\.(jpe?g|png|webp|heic)$/i.test(url || '');

// Thumbnail strip for a list of attachment URLs — images open the lightbox,
// PDFs/other files open in a new tab.
function AttachmentStrip({ urls = [], onOpenImage }) {
  if (!urls.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {urls.map((url, i) => (
        isImageUrl(url) ? (
          <button key={i} type="button" onClick={() => onOpenImage(urls.filter(isImageUrl).indexOf(url))}
            className="w-14 h-14 rounded-md overflow-hidden border border-line shrink-0">
            <img src={url} alt="attachment" className="w-full h-full object-cover" />
          </button>
        ) : (
          <a key={i} href={url} target="_blank" rel="noreferrer"
            className="w-14 h-14 rounded-md border border-line shrink-0 flex flex-col items-center justify-center gap-0.5 text-ink-muted hover:border-brand-500 hover:text-ink transition">
            <FileText size={16} />
            <span className="text-[8px]">FILE</span>
          </a>
        )
      ))}
    </div>
  );
}

const DEFAULT_FILTERS = { status: '', priority: '', category: '', q: '' };

const STATUS_META = {
  open:            { label: 'Open',       tone: 'info',    icon: Clock },
  in_progress:     { label: 'In Progress',tone: 'brand',   icon: Loader2 },
  waiting_on_user: { label: 'Waiting',    tone: 'warning', icon: Hourglass },
  resolved:        { label: 'Resolved',   tone: 'success', icon: CheckCircle2 },
  closed:          { label: 'Closed',     tone: 'neutral', icon: XCircle },
};

const PRIORITY_META = {
  low:    { label: 'Low',    tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high:   { label: 'High',   tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

const CATEGORY_OPTS = [
  { value: '',                 label: 'All categories' },
  { value: 'ride_issue',       label: 'Ride Issue' },
  { value: 'payment_issue',    label: 'Payment Issue' },
  { value: 'driver_behavior',  label: 'Driver Behavior' },
  { value: 'safety_concern',   label: 'Safety Concern' },
  { value: 'app_bug',          label: 'App Bug' },
  { value: 'account',          label: 'Account' },
  { value: 'other',            label: 'Other' },
];

const STATUS_OPTS = [{ value: '', label: 'All statuses' },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))];

const PRIORITY_OPTS = [{ value: '', label: 'All priorities' },
  ...Object.entries(PRIORITY_META).map(([value, m]) => ({ value, label: m.label }))];

const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
};

// ─── Detail + reply modal ─────────────────────────────────────────────────────
function TicketModal({ id, onClose, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]); // File[] picked, not yet uploaded
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingField, setSavingField] = useState('');
  const [lightbox, setLightbox] = useState({ images: [], index: -1 });
  const fileInputRef = useRef(null);

  // Status/priority/remark are edited as a DRAFT — nothing is sent to the
  // server until "Save changes" is clicked. A dropdown misclick used to fire
  // an instant PATCH (e.g. accidentally closing a ticket); now it only
  // changes local state, and closing/resolving additionally requires a
  // remark + an explicit confirm.
  const [draft, setDraft] = useState({ status: '', priority: '', notes: '' });
  useEffect(() => {
    if (ticket) setDraft({ status: ticket.status, priority: ticket.priority, notes: ticket.resolution_notes || '' });
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = ticket && (
    draft.status !== ticket.status ||
    draft.priority !== ticket.priority ||
    draft.notes !== (ticket.resolution_notes || '')
  );
  const isClosingOut = ticket && draft.status !== ticket.status && ['resolved', 'closed'].includes(draft.status);

  // All image attachments across ticket + messages, in display order — the
  // lightbox indexes into this flat list regardless of which strip was clicked.
  const allImages = [
    ...(ticket?.attachments || []).filter(isImageUrl),
    ...messages.flatMap(m => (m.attachments || []).filter(isImageUrl)),
  ].map(url => ({ url, label: 'Attachment' }));

  const openImageAt = (urls, urlIndexWithinUrls) => {
    const url = urls.filter(isImageUrl)[urlIndexWithinUrls];
    const flatIndex = allImages.findIndex(img => img.url === url);
    setLightbox({ images: allImages, index: flatIndex >= 0 ? flatIndex : 0 });
  };

  const load = useCallback(() => {
    setLoading(true);
    getSupportTicket(id)
      .then(res => {
        setTicket(res.data?.data?.ticket || null);
        setMessages(res.data?.data?.messages || []);
        setError('');
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveChanges = async () => {
    if (!isDirty) return;
    if (isClosingOut && !draft.notes.trim()) {
      setError(`Add a remark before marking this ticket ${STATUS_META[draft.status].label}.`);
      return;
    }
    if (isClosingOut) {
      const label = STATUS_META[draft.status].label;
      if (!window.confirm(`Mark this ticket as "${label}"? Make sure the remark is accurate — this is shown in reports.`)) return;
    }
    setSavingField('changes');
    setError('');
    try {
      await updateSupportTicket(id, {
        status: draft.status,
        priority: draft.priority,
        resolution_notes: draft.notes,
      });
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Update failed');
    } finally {
      setSavingField('');
    }
  };

  const sendReply = async () => {
    if (!reply.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      let attachments = [];
      if (pendingFiles.length) {
        setUploading(true);
        const res = await uploadSupportAttachments(pendingFiles);
        attachments = res.data?.data?.attachments || [];
        const failed = res.data?.data?.failed || [];
        setUploading(false);
        if (failed.length) setError(`Some files failed to upload: ${failed.join(', ')}`);
      }
      await replySupportTicket(id, reply.trim() || '(attachment)', attachments);
      setReply('');
      setPendingFiles([]);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Reply failed');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const addFiles = (fileList) => {
    const next = [...pendingFiles, ...Array.from(fileList)].slice(0, 5);
    setPendingFiles(next);
  };
  const removeFile = (i) => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i));

  return (
    <Modal open onClose={onClose} title={ticket ? `#${ticket.ticket_number}` : 'Ticket'} size="lg"
      footer={<div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>}>
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-xs"><Spinner size={14} /> Loading…</div>
      ) : error && !ticket ? (
        <Alert tone="danger">{error}</Alert>
      ) : ticket ? (
        <div className="space-y-4">
          {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{ticket.subject}</p>
              <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{ticket.description}</p>
              <AttachmentStrip urls={ticket.attachments} onOpenImage={(i) => openImageAt(ticket.attachments, i)} />
            </div>
          </div>

          <Card padding="sm">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">User</p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-ink font-semibold">{ticket.user_full_name}</span>
              <span className="text-ink-muted">{ticket.user_phone}</span>
              <Badge>{ticket.user_role}</Badge>
              {ticket.ride_id && <span className="text-ink-muted">Ride #{ticket.ride_id}</span>}
            </div>
          </Card>

          <Card padding="sm" className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" size="sm" value={draft.status}
                onChange={(v) => setDraft(d => ({ ...d, status: v }))}
                options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))} />
              <Select label="Priority" size="sm" value={draft.priority}
                onChange={(v) => setDraft(d => ({ ...d, priority: v }))}
                options={Object.entries(PRIORITY_META).map(([value, m]) => ({ value, label: m.label }))} />
            </div>

            {(isClosingOut || draft.notes) && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
                  Remark {isClosingOut && <span className="text-red-600">— required to {STATUS_META[draft.status].label.toLowerCase()}</span>}
                </label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="What was done / resolution summary…"
                  rows={2}
                  className={`w-full bg-white rounded-lg px-3 py-2 border text-xs text-ink outline-none resize-none
                    ${isClosingOut && !draft.notes.trim() ? 'border-red-400' : 'border-line focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20'}`}
                />
              </div>
            )}

            {isDirty && (
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setDraft({ status: ticket.status, priority: ticket.priority, notes: ticket.resolution_notes || '' })}>
                  Discard
                </Button>
                <Button variant={isClosingOut ? 'danger' : 'primary'} size="sm"
                  loading={savingField === 'changes'} onClick={saveChanges}>
                  {isClosingOut ? `Mark ${STATUS_META[draft.status].label}` : 'Save changes'}
                </Button>
              </div>
            )}
          </Card>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2">Conversation</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {messages.length === 0 && <p className="text-xs text-ink-faint">No messages yet.</p>}
              {messages.map(m => {
                const isAdmin = m.sender_role === 'admin';
                return (
                  <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    isAdmin ? 'ml-auto bg-accent-navy text-white' : 'bg-surface-alt text-ink'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <AttachmentStrip urls={m.attachments} onOpenImage={(i) => openImageAt(m.attachments, i)} />
                    <p className={`text-[10px] mt-1 ${isAdmin ? 'text-brand-400/80' : 'text-ink-faint'}`}>
                      {isAdmin ? 'You' : ticket.user_full_name} · {fmtTime(m.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-brand-100 text-brand-800 text-[11px] px-2 py-1 rounded-md">
                    {f.name.slice(0, 20)}
                    <button type="button" onClick={() => removeFile(i)} className="hover:text-red-600"><XIcon size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-lg border border-line text-ink-muted hover:border-brand-500 hover:text-ink transition shrink-0"
                title="Attach files">
                <Paperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                rows={2}
                className="flex-1 bg-white rounded-lg px-3 py-2 border border-line text-sm text-ink outline-none
                  focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 resize-none"
              />
              <Button variant="primary" icon={Send} loading={sending || uploading} onClick={sendReply}>
                {uploading ? 'Uploading…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        images={lightbox.images}
        index={lightbox.index >= 0 ? lightbox.index : null}
        onIndex={(i) => setLightbox(l => ({ ...l, index: i }))}
        onClose={() => setLightbox({ images: [], index: -1 })}
      />
    </Modal>
  );
}

// ─── List page ────────────────────────────────────────────────────────────────
export default function SupportTicketsPage() {
  const [f, setFilter] = useUrlFilters(DEFAULT_FILTERS);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState(() => {
    const v = searchParams.get('open');
    return v ? Number(v) : null;
  });

  const closeModal = () => {
    setOpenId(null);
    if (searchParams.get('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

  const loadStats = useCallback(() => {
    getSupportStats().then(res => setStats(res.data?.data || null)).catch(() => {});
  }, []);

  const load = useCallback(async ({ origin = 'load' } = {}) => {
    if (origin === 'refresh') setRefreshing(true);
    setError('');
    try {
      const res = await getSupportTickets({
        status: f.status || undefined, priority: f.priority || undefined,
        category: f.category || undefined, search: f.q || undefined,
        page: 1, limit: 50,
      });
      const d = res.data?.data || {};
      setItems(d.items || []);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load tickets');
    } finally {
      setInitialLoad(false); setRefreshing(false);
    }
  }, [f]);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  const refreshAll = () => { load({ origin: 'refresh' }); loadStats(); };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <MessageCircle size={18} className="text-brand-700" /> Support Tickets
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">Passenger and driver support requests</p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refreshAll} loading={refreshing}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatTile label="Open" value={stats.open} tone="info" icon={Clock}
            onClick={() => setFilter({ status: 'open' })} />
          <StatTile label="In Progress" value={stats.in_progress} tone="brand" icon={Loader2}
            onClick={() => setFilter({ status: 'in_progress' })} />
          <StatTile label="Waiting" value={stats.waiting} tone="warning" icon={Hourglass}
            onClick={() => setFilter({ status: 'waiting_on_user' })} />
          <StatTile label="Resolved" value={stats.resolved} tone="success" icon={CheckCircle2}
            onClick={() => setFilter({ status: 'resolved' })} />
          <StatTile label="Closed" value={stats.closed} tone="neutral" icon={XCircle}
            onClick={() => setFilter({ status: 'closed' })} />
          <StatTile label="Urgent (open)" value={stats.urgent} tone="danger" icon={AlertTriangle}
            onClick={() => setFilter({ priority: 'urgent', status: '' })} />
        </div>
      )}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Search</label>
            <SearchBar value={f.q} onSubmit={(v) => setFilter({ q: v })}
              placeholder="Ticket #, subject, name, phone…" />
          </div>
          <Select label="Status"   value={f.status}   onChange={(v) => setFilter({ status: v })}   options={STATUS_OPTS}   className="min-w-[160px]" />
          <Select label="Priority" value={f.priority} onChange={(v) => setFilter({ priority: v })} options={PRIORITY_OPTS} className="min-w-[160px]" />
          <Select label="Category" value={f.category} onChange={(v) => setFilter({ category: v })} options={CATEGORY_OPTS} className="min-w-[180px]" />
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {initialLoad ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No tickets found" description="Adjust filters or clear all" />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">Showing {items.length} of {total}</p>
          <Table>
            <THead>
              <tr>
                <TH>Ticket</TH>
                <TH>User</TH>
                <TH>Category</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map(t => {
                const sMeta = STATUS_META[t.status] || { label: t.status, tone: 'neutral', icon: Clock };
                const pMeta = PRIORITY_META[t.priority] || { label: t.priority, tone: 'neutral' };
                return (
                  <TR key={t.id} onClick={() => setOpenId(t.id)}>
                    <TD>
                      <p className="text-xs font-mono text-ink truncate max-w-[160px]" title={t.ticket_number}>{t.ticket_number}</p>
                      <p className="text-[11px] text-ink-muted truncate max-w-[220px]">{t.subject}</p>
                    </TD>
                    <TD className="max-w-[200px]">
                      <p className="text-sm text-ink font-medium truncate">{t.user_full_name || '—'}</p>
                      <p className="text-[11px] text-ink-muted truncate">{t.user_phone}</p>
                    </TD>
                    <TD><span className="text-[11px] text-ink-muted capitalize">{t.category?.replace(/_/g, ' ')}</span></TD>
                    <TD><Badge tone={pMeta.tone}>{pMeta.label}</Badge></TD>
                    <TD><Badge tone={sMeta.tone} icon={sMeta.icon}>{sMeta.label}</Badge></TD>
                    <TD><span className="text-[11px] text-ink-muted">{fmtTime(t.created_at)}</span></TD>
                    <TD align="right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
                      >
                        View <ChevronRight size={12} />
                      </button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </>
      )}

      {openId && <TicketModal id={openId} onClose={closeModal} onChanged={refreshAll} />}
    </div>
  );
}
