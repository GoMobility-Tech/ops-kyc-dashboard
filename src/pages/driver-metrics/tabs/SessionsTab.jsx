import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ListChecks } from 'lucide-react';
import { getDriverSessions } from '../../../api/opsApi.js';
import {
  Card, Badge, Alert, Spinner, EmptyState, Button,
  Table, THead, TBody, TH, TR, TD, DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import {
  defaultRange, MAX_RANGE_DAYS, endReasonMeta, fmtDur, fmtFull, fmtMoney,
  fmtNum, fmtKm, apiError,
} from '../metricsMeta.js';

const PAGE = 50;

export default function SessionsTab({ driverId }) {
  const [range, setRange] = useState(() => defaultRange(7));
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore]   = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ offset = 0, append = false } = {}) => {
    append ? setMore(true) : setLoading(true);
    try {
      const res = await getDriverSessions(driverId, { ...range, limit: PAGE, offset });
      const d = res.data?.data || {};
      setItems(prev => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
      setTotal(d.total || 0);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load sessions'));
    } finally {
      setLoading(false); setMore(false);
    }
  }, [driverId, range]);

  useEffect(() => { load(); }, [load]);

  const involuntary = items.filter(s => s.wasInvoluntary).length;

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          fieldOptions={[]}
          presets={ROLLING_PRESETS}
          maxDays={MAX_RANGE_DAYS}
          allowAll={false}
          onChange={({ from, to }) => from && setRange({ from, to: to || from })}
        />
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {involuntary > 0 && (
        <Alert tone="warning" title={`${involuntary} sessions the driver did not end themselves`}>
          These ended from an app crash, a network drop, or a system rule. If it keeps happening,
          it points at a problem with the driver's phone or app.
        </Alert>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No sessions in this range" description="Try a different date range." />
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">Showing {items.length} of {total}</p>

          <Table>
            <THead>
              <tr>
                <TH>Online from</TH>
                <TH>Offline at</TH>
                <TH>Duration</TH>
                <TH>How it ended</TH>
                <TH>Rides</TH>
                <TH>Distance</TH>
                <TH align="right">Earnings</TH>
              </tr>
            </THead>
            <TBody>
              {/* `rides.offered` is always 0 at session level — deliberately not a
                  column. The Stats tab's offeredApprox is the number to use. */}
              {items.map(s => {
                const reason = endReasonMeta(s.endReason);
                return (
                  <TR key={s.id}>
                    <TD>
                      <p className="text-xs text-ink">{fmtFull(s.startedAt)}</p>
                      <p className="text-[10px] text-ink-faint">
                        {s.startCity?.name || '—'}
                        {s.vehicleTypes?.length ? ` · ${s.vehicleTypes.join(', ')}` : ''}
                      </p>
                    </TD>
                    <TD>
                      {s.isOpen || !s.endedAt ? (
                        <Badge tone="success">Still online</Badge>
                      ) : (
                        <>
                          <p className="text-xs text-ink">{fmtFull(s.endedAt)}</p>
                          <p className="text-[10px] text-ink-faint">{s.endCity?.name || '—'}</p>
                        </>
                      )}
                    </TD>
                    <TD>
                      <span className="text-xs font-semibold text-ink tabular-nums">
                        {fmtDur(s.durationLabel, s.durationSeconds)}
                      </span>
                    </TD>
                    <TD>
                      {s.endReason || s.wasInvoluntary ? (
                        <span className="inline-flex items-center gap-1.5">
                          {s.wasInvoluntary && (
                            <AlertTriangle
                              size={13}
                              className="text-amber-600 shrink-0"
                              aria-label="The driver did not go offline themselves"
                            />
                          )}
                          <Badge tone={reason.tone} icon={reason.icon}>{reason.label}</Badge>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </TD>
                    <TD>
                      <span className="text-xs text-ink tabular-nums">{fmtNum(s.rides?.completed, '0')}</span>
                      {s.rides?.cancelled > 0 && (
                        <span className="text-[10px] text-red-600 ml-1">/ {s.rides.cancelled} cancelled</span>
                      )}
                      {s.rides?.rejected > 0 && (
                        <p className="text-[10px] text-ink-faint">{s.rides.rejected} rejected</p>
                      )}
                    </TD>
                    <TD><span className="text-xs text-ink-muted tabular-nums">{fmtKm(s.distanceKm)}</span></TD>
                    <TD align="right">
                      <span className="text-xs font-semibold text-ink tabular-nums">{fmtMoney(s.earnings)}</span>
                    </TD>
                  </TR>
                );
              })}
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
