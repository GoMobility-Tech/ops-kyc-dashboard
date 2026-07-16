import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, ChevronDown, ChevronRight, CreditCard, Copy, Check,
  CheckCircle2, XCircle, Clock, Ban, RotateCcw,
} from 'lucide-react';
import { getPaymentOrders, getPaymentOrderDetail } from '../../api/opsApi.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD,
  Select, SearchBar, DateRangeFilter, Modal, JsonViewer,
} from '../../components/ui';

const STATUS_META = {
  created:            { label: 'Created',      tone: 'neutral', icon: Clock },
  attempted:          { label: 'Attempted',    tone: 'info',    icon: Clock },
  success:            { label: 'Success',      tone: 'success', icon: CheckCircle2 },
  failed:             { label: 'Failed',       tone: 'danger',  icon: XCircle },
  refunded:           { label: 'Refunded',     tone: 'warning', icon: RotateCcw },
  partially_refunded: { label: 'Partial Refund', tone: 'warning', icon: RotateCcw },
  cancelled:          { label: 'Cancelled',    tone: 'neutral', icon: Ban },
};

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
];

const PURPOSE_OPTS = [
  { value: '',                 label: 'All purposes' },
  { value: 'ride_payment',     label: 'Ride Payment' },
  { value: 'wallet_recharge',  label: 'Wallet Recharge' },
  { value: 'subscription',     label: 'Subscription' },
  { value: 'cancellation_fee', label: 'Cancellation Fee' },
  { value: 'tip',              label: 'Tip' },
];

const GATEWAY_OPTS = [
  { value: '',          label: 'All gateways' },
  { value: 'razorpay',  label: 'Razorpay' },
  { value: 'cashfree',  label: 'Cashfree' },
];

const METHOD_OPTS = [
  { value: '',       label: 'All methods' },
  { value: 'upi',    label: 'UPI' },
  { value: 'card',   label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'qr',     label: 'QR' },
  { value: 'cash',   label: 'Cash' },
];

const fmtAmount = (a, curr = 'INR') => {
  const n = parseFloat(a);
  if (isNaN(n)) return '—';
  const sym = curr === 'INR' ? '₹' : `${curr} `;
  return sym + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
};

function CopyBtn({ value }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); }
    catch { /* clipboard blocked */ }
  };
  return (
    <button onClick={copy} className="text-ink-faint hover:text-accent-navy transition" title="Copy">
      {ok ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function OrderDetailModal({ id, onClose }) {
  const [state, setState] = useState({ loading: true, order: null, refunds: [], error: null });

  useEffect(() => {
    let cancelled = false;
    getPaymentOrderDetail(id)
      .then(res => {
        if (cancelled) return;
        const d = res.data?.data || {};
        setState({ loading: false, order: d.order, refunds: d.refunds || [], error: null });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ loading: false, order: null, refunds: [], error: err.response?.data?.message || 'Failed to load' });
      });
    return () => { cancelled = true; };
  }, [id]);

  const { loading, order, refunds, error } = state;
  const meta = order && (STATUS_META[order.status] || { label: order.status, tone: 'neutral', icon: Clock });

  return (
    <Modal
      open
      onClose={onClose}
      title="Payment Order"
      size="lg"
      footer={<div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>}
    >
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-xs">
          <Spinner size={14} /> Loading…
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : order ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-lg bg-accent-navy text-white p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-brand-400 text-[10px] uppercase tracking-wider font-semibold">{order.purpose?.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold mt-0.5">{fmtAmount(order.amount, order.currency)}</p>
              <p className="text-brand-400/80 text-[11px] mt-1 font-mono">{order.order_number}</p>
            </div>
            <div className="text-right space-y-1">
              <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
              <p className="text-brand-400/80 text-[10px]">{order.payment_gateway?.toUpperCase()} · {order.payment_method?.toUpperCase()}</p>
            </div>
          </div>

          {/* User */}
          {order.user && (
            <Card padding="sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">User</p>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-ink font-semibold">{order.user.full_name}</span>
                <span className="text-ink-muted">{order.user.phone_number}</span>
                {order.user.email && <span className="text-ink-muted">{order.user.email}</span>}
                {order.user.go_id && <span className="text-accent-navy font-mono">{order.user.go_id}</span>}
                <Badge>{order.user.role}</Badge>
                {order.user.is_test_user && <Badge tone="warning">TEST</Badge>}
              </div>
            </Card>
          )}

          {/* Gateway IDs */}
          <Card padding="sm">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Gateway References</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-ink-faint text-[10px]">order_id:</span>
                <span className="font-mono text-ink truncate flex-1">{order.gateway_order_id || '—'}</span>
                <CopyBtn value={order.gateway_order_id} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ink-faint text-[10px]">payment_id:</span>
                <span className="font-mono text-ink truncate flex-1">{order.gateway_payment_id || '—'}</span>
                <CopyBtn value={order.gateway_payment_id} />
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card padding="sm">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Timeline</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div><p className="text-ink-faint text-[10px]">Created</p><p className="text-ink font-medium">{fmtTime(order.created_at)}</p></div>
              <div><p className="text-ink-faint text-[10px]">Paid</p><p className="text-ink font-medium">{fmtTime(order.paid_at)}</p></div>
              <div><p className="text-ink-faint text-[10px]">Updated</p><p className="text-ink font-medium">{fmtTime(order.updated_at)}</p></div>
            </div>
          </Card>

          {order.failure_reason && (
            <Alert tone="danger" title="Failure reason">{order.failure_reason}</Alert>
          )}

          {order.description && (
            <Card padding="sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Description</p>
              <p className="text-xs text-ink">{order.description}</p>
            </Card>
          )}

          <JsonViewer label="Metadata" data={order.metadata} />

          {/* Refunds */}
          {refunds.length > 0 && (
            <Card padding="sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2">Refunds</p>
              <div className="space-y-2">
                {refunds.map(r => (
                  <div key={r.id} className="rounded border border-line bg-white p-2 flex items-center gap-2 text-xs">
                    <RotateCcw size={12} className="text-amber-600" />
                    <span className="font-semibold text-ink">{fmtAmount(r.amount)}</span>
                    <Badge tone={r.status === 'success' ? 'success' : r.status === 'failed' ? 'danger' : 'info'}>{r.status}</Badge>
                    <span className="text-ink-muted flex-1 truncate">{r.reason || '—'}</span>
                    <span className="text-ink-faint text-[10px]">{fmtTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

// ─── List page ────────────────────────────────────────────────────────────────
export default function PaymentOrdersPage() {
  const [status,  setStatus]  = useState('');
  const [purpose, setPurpose] = useState('');
  const [gateway, setGateway] = useState('');
  const [method,  setMethod]  = useState('');
  const [search,  setSearch]  = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [dateField,setDateField]= useState('created_at');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page,  setPage]  = useState(1);

  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async ({ pg = 1, append = false, origin = 'load' } = {}) => {
    if (origin === 'refresh') setRefreshing(true);
    if (append) setLoadingMore(true);
    setError('');
    try {
      const res = await getPaymentOrders({
        status, purpose, gateway, method, search,
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
        dateField,
        page: pg, limit: 20,
      });
      const d = res.data?.data || {};
      const rows = d.items || [];
      setItems(prev => append ? [...prev, ...rows] : rows);
      setTotal(d.total || 0);
      setPage(pg);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load orders');
    } finally {
      setInitialLoad(false); setRefreshing(false); setLoadingMore(false);
    }
  }, [status, purpose, gateway, method, search, dateFrom, dateTo, dateField]);

  useEffect(() => { load({ pg: 1 }); }, [load]);

  const hasMore = items.length < total;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <CreditCard size={18} className="text-brand-700" /> Payment Orders
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">Gateway attempts — Razorpay & Cashfree</p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load({ pg: 1, origin: 'refresh' })} loading={refreshing}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Search</label>
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={() => load({ pg: 1 })}
              placeholder="Order/payment id, phone, name, GO ID…"
            />
          </div>
          <Select label="Status"  value={status}  onChange={setStatus}  options={STATUS_OPTS}  className="min-w-[160px]" />
          <Select label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSE_OPTS} className="min-w-[170px]" />
          <Select label="Gateway" value={gateway} onChange={setGateway} options={GATEWAY_OPTS} className="min-w-[140px]" />
          <Select label="Method"  value={method}  onChange={setMethod}  options={METHOD_OPTS}  className="min-w-[140px]" />
        </div>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          field={dateField}
          fieldOptions={[
            { value: 'created_at', label: 'Created At' },
            { value: 'paid_at',    label: 'Paid At' },
          ]}
          onChange={({ from, to, field }) => { setDateFrom(from); setDateTo(to); setDateField(field); }}
        />
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {initialLoad ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No orders found" description="Adjust filters or clear all" />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">Showing {items.length} of {total}</p>
          <Table>
            <THead>
              <tr>
                <TH>Order</TH>
                <TH>User</TH>
                <TH>Amount</TH>
                <TH>Purpose</TH>
                <TH>Gateway</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map(o => {
                const meta = STATUS_META[o.status] || { label: o.status, tone: 'neutral', icon: Clock };
                return (
                  <TR key={o.id} onClick={() => setOpenId(o.id)}>
                    <TD>
                      <p className="text-xs font-mono text-ink truncate max-w-[200px]" title={o.order_number}>{o.order_number}</p>
                      {o.gateway_payment_id && (
                        <p className="text-[10px] font-mono text-ink-faint truncate max-w-[200px]">{o.gateway_payment_id}</p>
                      )}
                    </TD>
                    <TD className="max-w-[220px]">
                      <p className="text-sm text-ink font-medium truncate">{o.user?.full_name || '—'}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {o.user?.phone_number}{o.user?.go_id ? ` · ${o.user.go_id}` : ''}
                      </p>
                    </TD>
                    <TD>
                      <span className="text-sm font-semibold text-accent-navy tabular-nums">
                        {fmtAmount(o.amount, o.currency)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-ink-muted capitalize">{o.purpose?.replace(/_/g, ' ')}</span>
                    </TD>
                    <TD>
                      <div className="text-[11px] text-ink">
                        <span className="capitalize">{o.payment_gateway}</span>
                        <span className="text-ink-faint"> · {o.payment_method?.toUpperCase()}</span>
                      </div>
                    </TD>
                    <TD><Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge></TD>
                    <TD><span className="text-[11px] text-ink-muted">{fmtTime(o.created_at)}</span></TD>
                    <TD align="right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenId(o.id); }}
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

          {hasMore && (
            <Button variant="outline" className="w-full" icon={ChevronDown} loading={loadingMore}
              onClick={() => load({ pg: page + 1, append: true })}>
              Load more
            </Button>
          )}
        </>
      )}

      {openId && <OrderDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
