import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, ChevronDown, ChevronRight, Receipt, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, XCircle, Clock, RotateCcw,
} from 'lucide-react';
import { getTransactions, getTransactionDetail } from '../../api/opsApi.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert,
  Table, THead, TBody, TH, TR, TD,
  Select, SearchBar, DateRangeFilter, Modal, JsonViewer,
} from '../../components/ui';

const STATUS_META = {
  pending:  { label: 'Pending',  tone: 'info',    icon: Clock },
  success:  { label: 'Success',  tone: 'success', icon: CheckCircle2 },
  failed:   { label: 'Failed',   tone: 'danger',  icon: XCircle },
  refunded: { label: 'Refunded', tone: 'warning', icon: RotateCcw },
};

const STATUS_OPTS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
];

const TYPE_OPTS = [
  { value: '',       label: 'All types' },
  { value: 'credit', label: 'Credit (+)' },
  { value: 'debit',  label: 'Debit (−)' },
];

const CATEGORY_OPTS = [
  { value: '',                  label: 'All categories' },
  { value: 'ride_payment',      label: 'Ride Payment' },
  { value: 'ride_refund',       label: 'Ride Refund' },
  { value: 'ride_earnings',     label: 'Ride Earnings' },
  { value: 'wallet_recharge',   label: 'Wallet Recharge' },
  { value: 'referral_bonus',    label: 'Referral Bonus' },
  { value: 'cancellation_fee',  label: 'Cancellation Fee' },
  { value: 'withdrawal',        label: 'Withdrawal' },
  { value: 'subscription',      label: 'Subscription' },
  { value: 'driver_incentive',  label: 'Driver Incentive' },
  { value: 'tip',               label: 'Tip' },
];

const METHOD_OPTS = [
  { value: '',          label: 'All methods' },
  { value: 'upi',       label: 'UPI' },
  { value: 'upi_qr',    label: 'UPI QR' },
  { value: 'card',      label: 'Card' },
  { value: 'wallet',    label: 'Wallet' },
  { value: 'cash',      label: 'Cash' },
  { value: 'corporate', label: 'Corporate' },
];

const fmtAmount = (a) => {
  const n = parseFloat(a);
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function TypeIndicator({ type }) {
  const isCredit = type === 'credit';
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
  const cls  = isCredit
    ? 'bg-green-100 text-green-800 border-green-400'
    : 'bg-red-100 text-red-800 border-red-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${cls}`}>
      <Icon size={11} /> {isCredit ? 'CREDIT' : 'DEBIT'}
    </span>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function TxDetailModal({ id, onClose }) {
  const [state, setState] = useState({ loading: true, tx: null, error: null });

  useEffect(() => {
    let cancelled = false;
    getTransactionDetail(id)
      .then(res => {
        if (cancelled) return;
        setState({ loading: false, tx: res.data?.data, error: null });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ loading: false, tx: null, error: err.response?.data?.message || 'Failed to load' });
      });
    return () => { cancelled = true; };
  }, [id]);

  const { loading, tx, error } = state;
  const meta = tx && (STATUS_META[tx.status] || { label: tx.status, tone: 'neutral', icon: Clock });
  const isCredit = tx?.type === 'credit';

  return (
    <Modal
      open
      onClose={onClose}
      title="Transaction"
      size="lg"
      footer={<div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>}
    >
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-xs">
          <Spinner size={14} /> Loading…
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : tx ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-accent-navy text-white p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-brand-400 text-[10px] uppercase tracking-wider font-semibold">{tx.category?.replace(/_/g, ' ')}</p>
              <p className={`text-2xl font-bold mt-0.5 ${isCredit ? 'text-green-300' : 'text-red-300'}`}>
                {isCredit ? '+' : '−'} {fmtAmount(tx.amount)}
              </p>
              <p className="text-brand-400/80 text-[11px] mt-1 font-mono">{tx.transaction_number}</p>
            </div>
            <div className="text-right space-y-1">
              <TypeIndicator type={tx.type} />
              <div><Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge></div>
              {tx.payment_method && (
                <p className="text-brand-400/80 text-[10px]">
                  {tx.payment_gateway ? `${tx.payment_gateway.toUpperCase()} · ` : ''}
                  {tx.payment_method.toUpperCase()}
                </p>
              )}
            </div>
          </div>

          {tx.user && (
            <Card padding="sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">User</p>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-ink font-semibold">{tx.user.full_name}</span>
                <span className="text-ink-muted">{tx.user.phone_number}</span>
                {tx.user.email && <span className="text-ink-muted">{tx.user.email}</span>}
                {tx.user.go_id && <span className="text-accent-navy font-mono">{tx.user.go_id}</span>}
                <Badge>{tx.user.role}</Badge>
                {tx.user.is_test_user && <Badge tone="warning">TEST</Badge>}
              </div>
            </Card>
          )}

          <Card padding="sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><p className="text-ink-faint text-[10px]">Wallet ID</p><p className="text-ink font-mono">{tx.wallet_id ?? '—'}</p></div>
              <div><p className="text-ink-faint text-[10px]">Ride ID</p><p className="text-ink font-mono">{tx.ride_id ?? '—'}</p></div>
              <div><p className="text-ink-faint text-[10px]">Gateway TX ID</p><p className="text-ink font-mono truncate" title={tx.gateway_transaction_id}>{tx.gateway_transaction_id ?? '—'}</p></div>
              <div><p className="text-ink-faint text-[10px]">Created</p><p className="text-ink">{fmtTime(tx.created_at)}</p></div>
            </div>
          </Card>

          {tx.description && (
            <Card padding="sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Description</p>
              <p className="text-xs text-ink">{tx.description}</p>
            </Card>
          )}

          <JsonViewer label="Metadata" data={tx.metadata} />
        </div>
      ) : null}
    </Modal>
  );
}

// ─── List page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [type,     setType]     = useState('');
  const [category, setCategory] = useState('');
  const [status,   setStatus]   = useState('');
  const [method,   setMethod]   = useState('');
  const [search,   setSearch]   = useState('');
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
      const res = await getTransactions({
        type, category, status, method, search,
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
      setError(e.response?.data?.message || 'Failed to load transactions');
    } finally {
      setInitialLoad(false); setRefreshing(false); setLoadingMore(false);
    }
  }, [type, category, status, method, search, dateFrom, dateTo, dateField]);

  useEffect(() => { load({ pg: 1 }); }, [load]);

  const hasMore = items.length < total;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <Receipt size={18} className="text-brand-700" /> Transactions
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">Internal ledger — every credit and debit</p>
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
              placeholder="Txn number, gateway id, phone, name, GO ID…"
            />
          </div>
          <Select label="Type"     value={type}     onChange={setType}     options={TYPE_OPTS}     className="min-w-[140px]" />
          <Select label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTS} className="min-w-[180px]" />
          <Select label="Status"   value={status}   onChange={setStatus}   options={STATUS_OPTS}   className="min-w-[140px]" />
          <Select label="Method"   value={method}   onChange={setMethod}   options={METHOD_OPTS}   className="min-w-[140px]" />
        </div>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          field={dateField}
          fieldOptions={[
            { value: 'created_at', label: 'Created At' },
            { value: 'updated_at', label: 'Updated At' },
          ]}
          onChange={({ from, to, field }) => { setDateFrom(from); setDateTo(to); setDateField(field); }}
        />
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {initialLoad ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions found" description="Adjust filters or clear all" />
      ) : (
        <>
          <p className="text-ink-muted text-xs px-1">Showing {items.length} of {total}</p>
          <Table>
            <THead>
              <tr>
                <TH>Type</TH>
                <TH>Transaction</TH>
                <TH>User</TH>
                <TH>Amount</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map(tx => {
                const meta = STATUS_META[tx.status] || { label: tx.status, tone: 'neutral', icon: Clock };
                const isCredit = tx.type === 'credit';
                return (
                  <TR key={tx.id} onClick={() => setOpenId(tx.id)}>
                    <TD><TypeIndicator type={tx.type} /></TD>
                    <TD>
                      <p className="text-xs font-mono text-ink truncate max-w-[200px]" title={tx.transaction_number}>{tx.transaction_number}</p>
                      {tx.gateway_transaction_id && (
                        <p className="text-[10px] font-mono text-ink-faint truncate max-w-[200px]">{tx.gateway_transaction_id}</p>
                      )}
                    </TD>
                    <TD className="max-w-[220px]">
                      <p className="text-sm text-ink font-medium truncate">{tx.user?.full_name || '—'}</p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {tx.user?.phone_number}{tx.user?.go_id ? ` · ${tx.user.go_id}` : ''}
                      </p>
                    </TD>
                    <TD>
                      <span className={`text-sm font-bold tabular-nums ${isCredit ? 'text-accent-green' : 'text-red-700'}`}>
                        {isCredit ? '+' : '−'} {fmtAmount(tx.amount)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-ink-muted capitalize">{tx.category?.replace(/_/g, ' ')}</span>
                    </TD>
                    <TD><Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge></TD>
                    <TD><span className="text-[11px] text-ink-muted">{fmtTime(tx.created_at)}</span></TD>
                    <TD align="right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenId(tx.id); }}
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

      {openId && <TxDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
