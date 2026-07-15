import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, RefreshCw, ChevronDown, AlertTriangle, ChevronRight, ExternalLink,
  FileText, CreditCard, Car, IdCard, User, Landmark,
} from 'lucide-react';
import { getReviewQueue, getDocumentDetail, approveDocument } from '../../api/opsApi.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD, Modal, JsonViewer,
} from '../../components/ui';
import RejectModal from '../../components/driver/RejectModal.jsx';
import DocThumb from '../../components/driver/DocThumb.jsx';
import ExtractedDataPanel from '../../components/driver/ExtractedDataPanel.jsx';

const DOC_LABELS = {
  AADHAAR:         'Aadhaar',
  PAN:             'PAN',
  DRIVING_LICENCE: 'Driving Licence',
  VEHICLE_RC:      'Vehicle RC',
  SELFIE:          'Selfie',
  BANK_ACCOUNT:    'Bank',
};

const DOC_ICONS = {
  AADHAAR:         IdCard,
  PAN:             CreditCard,
  DRIVING_LICENCE: IdCard,
  VEHICLE_RC:      Car,
  SELFIE:          User,
  BANK_ACCOUNT:    Landmark,
};

const TYPE_FILTERS = ['', 'AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VEHICLE_RC', 'SELFIE', 'BANK_ACCOUNT'];

const STATUS_FILTERS = [
  { key: 'manual_review', label: 'Manual Review' },
  { key: 'rejected',      label: 'Rejected'      },
  { key: 'all',           label: 'All'           },
];

const rejectionLabel = (raw) => {
  if (!raw) return '';
  if (raw === 'NUMBER_MISMATCH')              return 'Number mismatch (soft retry)';
  if (raw === 'NUMBER_MISMATCH_MAX_ATTEMPTS') return 'Number mismatch — 3 failed attempts';
  if (/Could not extract.+number/i.test(raw)) return 'OCR failed — image quality issue';
  if (/not found or invalid in government/i.test(raw)) return 'Government records mismatch';
  if (/private vehicle/i.test(raw))           return 'White plate (non-commercial)';
  if (/insurance has expired/i.test(raw))     return 'Insurance expired';
  if (/PUCC.+expired/i.test(raw))             return 'PUCC expired';
  return raw;
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── Doc detail modal ─────────────────────────────────────────────────────────
function DocDetailModal({ docId, onClose, onDone }) {
  const [doc, setDoc]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocumentDetail(docId)
      .then(res => { if (!cancelled) setDoc(res.data?.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'Failed to load doc'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [docId]);

  const approve = async () => {
    setApproving(true);
    try {
      await approveDocument(docId, 'Approved from Review Queue');
      onDone?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Approve failed');
    } finally { setApproving(false); }
  };

  const type   = doc?.document_type;
  const label  = DOC_LABELS[type] || type || 'Document';
  const front  = doc?.file_url;
  const back   = doc?.back_file_url;
  const status = doc?.status;
  const canDecide = status === 'manual_review' || status === 'rejected';

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={label}
        size="lg"
        footer={
          canDecide && (
            <div className="flex gap-2 justify-end">
              <Button variant="danger" onClick={() => setRejectOpen(true)}>Reject</Button>
              <Button onClick={approve} loading={approving}>Approve</Button>
            </div>
          )
        }
      >
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-xs">
            <Spinner size={14} /> Loading document…
          </div>
        ) : error ? (
          <Alert tone="danger">{error}</Alert>
        ) : doc ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status === 'rejected' ? 'danger' : status === 'manual_review' ? 'warning' : 'success'}>
                {String(status || '').replace(/_/g, ' ')}
              </Badge>
              {doc.confidence_score != null && (
                <Badge tone="info">Confidence {doc.confidence_score}%</Badge>
              )}
              {doc.attempt_count != null && (
                <Badge>Attempt {doc.attempt_count}/3</Badge>
              )}
              {doc.provided_number && (
                <span className="text-[11px] text-ink-muted font-mono">provided #{doc.provided_number}</span>
              )}
            </div>

            {doc.rejection_reason && (
              <Alert tone="danger" title="Rejection reason">{rejectionLabel(doc.rejection_reason)}</Alert>
            )}

            {(front || back) && (
              <div className="flex gap-2 flex-wrap">
                {front && <DocThumb url={front} label="Front" />}
                {back  && <DocThumb url={back}  label="Back" />}
              </div>
            )}

            {doc.extracted_data && (
              <ExtractedDataPanel docType={type} data={doc.extracted_data} score={doc.confidence_score} defaultOpen />
            )}

            {doc.ocr_raw_payload && (
              <JsonViewer label="OCR Raw Payload" data={doc.ocr_raw_payload} />
            )}
          </div>
        ) : null}
      </Modal>

      {rejectOpen && (
        <RejectModal
          docId={docId}
          docType={type}
          onDone={() => { setRejectOpen(false); onDone?.(); }}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReviewQueuePage() {
  const nav = useNavigate();
  const [type,   setType]   = useState('');
  const [status, setStatus] = useState('manual_review');
  const [items,  setItems]  = useState([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]   = useState('');
  const [openDocId, setOpenDocId] = useState(null);

  const load = useCallback(async ({ pg = 1, append = false, origin = 'load' } = {}) => {
    if (origin === 'refresh') setRefreshing(true);
    if (append) setLoadingMore(true);
    setError('');
    try {
      const res = await getReviewQueue({ type: type || undefined, status, page: pg, limit: 20 });
      const d = res.data?.data;
      const rows = d?.items || [];
      setItems(prev => append ? [...prev, ...rows] : rows);
      setTotal(d?.total || 0);
      setPage(pg);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load queue');
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [type, status]);

  useEffect(() => { load({ pg: 1 }); }, [load]);

  const hasMore = items.length < total;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <AlertTriangle size={18} className="text-brand-700" />
            Review Queue
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {total} document{total !== 1 ? 's' : ''} waiting for manual decision
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load({ pg: 1, origin: 'refresh' })} loading={refreshing}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card padding="sm" className="space-y-3">
        <div>
          <p className="text-ink-muted text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Filter size={10} /> Document type
          </p>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {TYPE_FILTERS.map(t => {
              const active = type === t;
              return (
                <button
                  key={t || 'all'}
                  onClick={() => setType(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                    ${active
                      ? 'bg-accent-navy text-white border-accent-navy'
                      : 'bg-surface-soft text-ink-muted border-line hover:border-accent-navy hover:text-accent-navy'}`}
                >
                  {t ? DOC_LABELS[t] : 'All types'}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-ink-muted text-[10px] uppercase tracking-wider mb-1.5">Status</p>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map(s => {
              const active = status === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap
                    ${active
                      ? 'bg-accent-navy text-white border-accent-navy'
                      : 'bg-surface-soft text-ink-muted border-line hover:border-accent-navy hover:text-accent-navy'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {initialLoad ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Queue is clear"
          description="No documents matching this filter — all caught up!"
        />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">Showing {items.length} of {total}</p>
          <Table>
            <THead>
              <tr>
                <TH>Driver</TH>
                <TH>Document</TH>
                <TH>Issue</TH>
                <TH>Attempts</TH>
                <TH>Updated</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map(it => {
                const Icon = DOC_ICONS[it.document_type] || FileText;
                const isMismatchMax = it.rejection_reason === 'NUMBER_MISMATCH_MAX_ATTEMPTS';
                return (
                  <TR key={it.id} onClick={() => setOpenDocId(it.id)}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full bg-accent-navy text-brand-400 font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-brand-500/40">
                          {(it.full_name || 'D')[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-ink font-medium text-sm truncate max-w-[200px]">{it.full_name || 'Unknown'}</p>
                          <p className="text-ink-muted text-[11px] truncate">{it.phone_number}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <Icon size={14} className="text-accent-navy" />
                        <span className="text-xs text-ink font-medium">{DOC_LABELS[it.document_type] || it.document_type}</span>
                        {isMismatchMax && <Badge tone="danger">Attention</Badge>}
                      </div>
                    </TD>
                    <TD className="max-w-[260px]">
                      {it.rejection_reason ? (
                        <p className="text-[11px] text-ink-muted line-clamp-2 leading-snug">
                          {rejectionLabel(it.rejection_reason)}
                        </p>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </TD>
                    <TD>
                      <span className="text-[11px] text-ink font-semibold tabular-nums">{it.attempt_count ?? 0}/3</span>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-ink-muted">{timeAgo(it.updated_at || it.created_at)}</span>
                    </TD>
                    <TD align="right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {it.user_id && (
                          <button
                            onClick={() => nav(`/all-drivers/${it.user_id}`)}
                            title="Open driver workspace"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-brand-100 border border-brand-400 text-brand-800 text-[11px] font-semibold hover:bg-brand-200 transition"
                          >
                            <ExternalLink size={12} /> Driver
                          </button>
                        )}
                        <button
                          onClick={() => setOpenDocId(it.id)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
                        >
                          Review <ChevronRight size={12} />
                        </button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              icon={ChevronDown}
              loading={loadingMore}
              onClick={() => load({ pg: page + 1, append: true })}
            >
              Load more
            </Button>
          )}
        </>
      )}

      {openDocId && (
        <DocDetailModal
          docId={openDocId}
          onClose={() => setOpenDocId(null)}
          onDone={() => { setOpenDocId(null); load({ pg: 1, origin: 'refresh' }); }}
        />
      )}
    </div>
  );
}
