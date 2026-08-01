import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronDown, ArrowDown } from 'lucide-react';
import { getLeaderboard } from '../../../api/opsApi.js';
import {
  Card, Alert, Spinner, EmptyState, Button, Select,
  Table, THead, TBody, TH, TR, TD, DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import { StatusPill, VehicleTypes } from '../DriverBits.jsx';
import {
  defaultRange, MAX_RANGE_DAYS, fmtDur, fmtMoney, fmtNum, fmtRate, apiError,
} from '../metricsMeta.js';

const PAGE = 50;

// Column → the `sort` value the API understands. Columns without an entry
// aren't server-sortable, and we don't fake it by sorting the current page.
const COLUMNS = [
  { key: 'rank',      label: '#' },
  { key: 'driver',    label: 'Driver' },
  { key: 'city',      label: 'City' },
  { key: 'status',    label: 'Status' },
  { key: 'online',    label: 'Online',      sort: 'online_hours', align: 'right' },
  { key: 'sessions',  label: 'Sessions',    sort: 'sessions',     align: 'right' },
  { key: 'rides',     label: 'Rides',       sort: 'rides',        align: 'right' },
  { key: 'accept',    label: 'Acceptance',  sort: 'acceptance',   align: 'right' },
  { key: 'earnings',  label: 'Earnings',    sort: 'earnings',     align: 'right' },
];

export default function LeaderboardTab({ includeTest, cityOpts }) {
  const navigate = useNavigate();
  const [range, setRange] = useState(() => defaultRange(7));
  const [sort, setSort]   = useState('online_hours');
  const [cityId, setCityId] = useState('');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore]   = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ offset = 0, append = false } = {}) => {
    append ? setMore(true) : setLoading(true);
    try {
      const res = await getLeaderboard({
        ...range, sort, cityId: cityId || undefined, includeTest, limit: PAGE, offset,
      });
      const d = res.data?.data || {};
      setItems(prev => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
      setTotal(d.total || 0);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load leaderboard'));
    } finally {
      setLoading(false); setMore(false);
    }
  }, [range, sort, cityId, includeTest]);

  useEffect(() => { load(); }, [load]);

  // Changing the sort restarts paging — `rank` is server-assigned and already
  // accounts for offset, so mixing pages from two sorts would corrupt it.
  const changeSort = (next) => { if (next && next !== sort) setSort(next); };

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            from={range.from}
            to={range.to}
            fieldOptions={[]}
            presets={ROLLING_PRESETS}
            maxDays={MAX_RANGE_DAYS}
            allowAll={false}
            onChange={({ from, to }) => from && setRange({ from, to: to || from })}
          />
          <Select label="City" value={cityId} onChange={setCityId} options={cityOpts} className="min-w-[170px]" />
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Trophy} title="No drivers active in this range" description="Try a different date range or city." />
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">Showing {items.length} of {total}</p>

          <Table>
            <THead>
              <tr>
                {COLUMNS.map(c => (
                  <TH key={c.key} align={c.align || 'left'}>
                    {c.sort ? (
                      <button
                        onClick={() => changeSort(c.sort)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider transition
                          ${sort === c.sort ? 'text-white' : 'text-brand-400 hover:text-white'}`}
                      >
                        {c.label}
                        {sort === c.sort && <ArrowDown size={10} />}
                      </button>
                    ) : c.label}
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {items.map(r => (
                <TR key={r.driverId} onClick={() => navigate(`/driver-metrics/drivers/${r.driverId}`)}>
                  <TD>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold tabular-nums
                      ${r.rank <= 3 ? 'bg-brand-400 text-accent-navy' : 'bg-surface-alt text-ink-muted'}`}>
                      {r.rank}
                    </span>
                  </TD>
                  <TD className="max-w-[220px]">
                    <p className="text-xs font-semibold text-ink truncate">{r.name || `Driver #${r.driverId}`}</p>
                    <p className="text-[11px] text-ink-muted truncate">{r.phone}</p>
                    <VehicleTypes types={r.vehicleTypes || []} />
                  </TD>
                  <TD><span className="text-[11px] text-ink-muted">{r.cityName || '—'}</span></TD>
                  <TD><StatusPill status={r.status} /></TD>
                  <TD align="right">
                    <span className="text-xs font-semibold text-ink tabular-nums">
                      {fmtDur(r.onlineLabel, r.onlineSeconds)}
                    </span>
                  </TD>
                  <TD align="right"><span className="text-xs text-ink-muted tabular-nums">{fmtNum(r.sessionsCount, '0')}</span></TD>
                  <TD align="right">
                    <span className="text-xs text-ink tabular-nums">{fmtNum(r.ridesCompleted, '0')}</span>
                    {r.ridesCancelled > 0 && (
                      <span className="text-[10px] text-red-600 ml-1">/ {r.ridesCancelled}</span>
                    )}
                  </TD>
                  <TD align="right">
                    {/* null acceptanceRate means no offers at all — never render it as 0% */}
                    <span className={`text-xs tabular-nums ${r.acceptanceRate == null ? 'text-ink-faint' : 'text-ink'}`}>
                      {fmtRate(r.acceptanceRate)}
                    </span>
                    {r.ridesRejected > 0 && (
                      <p className="text-[10px] text-ink-faint">{r.ridesRejected} rejected</p>
                    )}
                  </TD>
                  <TD align="right">
                    <span className="text-xs font-semibold text-ink tabular-nums">{fmtMoney(r.grossFare)}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {items.length < total && (
            <Button
              variant="outline"
              className="w-full"
              icon={ChevronDown}
              loading={more}
              onClick={() => load({ offset: items.length, append: true })}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
