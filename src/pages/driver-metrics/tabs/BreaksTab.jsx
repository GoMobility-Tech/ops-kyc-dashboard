import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, BellOff, CheckCircle2 } from 'lucide-react';
import { getDriverBreaks } from '../../../api/opsApi.js';
import {
  Card, Badge, Alert, Spinner, EmptyState, Button,
  Table, THead, TBody, TH, TR, TD, DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import {
  defaultRange, MAX_RANGE_DAYS, breakLevelMeta, fmtDur, fmtFull, apiError,
} from '../metricsMeta.js';

const PAGE = 50;

export default function BreaksTab({ driverId }) {
  const [range, setRange] = useState(() => defaultRange(30));
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore]   = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ offset = 0, append = false } = {}) => {
    append ? setMore(true) : setLoading(true);
    try {
      const res = await getDriverBreaks(driverId, { ...range, limit: PAGE, offset });
      const d = res.data?.data || {};
      setItems(prev => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
      setTotal(d.total || 0);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load break history'));
    } finally {
      setLoading(false); setMore(false);
    }
  }, [driverId, range]);

  useEffect(() => { load(); }, [load]);

  // A break alert that never reached the driver is the worst failure mode here:
  // the system thinks it warned them and the driver never saw a thing.
  const undelivered = items.filter(b => Array.isArray(b.notifiedChannels) && b.notifiedChannels.length === 0).length;

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

      {undelivered > 0 && (
        <Alert tone="danger" title={`${undelivered} alerts never reached the driver`}>
          The alert was created but delivered on no channel — the driver never learned a break was due.
        </Alert>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No break violations"
          description="The driver stayed within the break rules in this range."
        />
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">Showing {items.length} of {total}</p>

          <Table>
            <THead>
              <tr>
                <TH>What happened</TH>
                <TH>When</TH>
                <TH>Continuous duty</TH>
                <TH>Streak start</TH>
                <TH>Seen by driver?</TH>
                <TH>Channels</TH>
              </tr>
            </THead>
            <TBody>
              {items.map(b => {
                const m = breakLevelMeta(b.level);
                const channels = Array.isArray(b.notifiedChannels) ? b.notifiedChannels : [];
                return (
                  <TR key={b.id}>
                    <TD>
                      <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>
                      {b.sessionId && <p className="text-[10px] text-ink-faint mt-1">Session #{b.sessionId}</p>}
                    </TD>
                    <TD><span className="text-xs text-ink">{fmtFull(b.triggeredAt)}</span></TD>
                    <TD>
                      <span className="text-xs font-semibold text-ink tabular-nums">
                        {fmtDur(b.continuousLabel, b.continuousSeconds)}
                      </span>
                    </TD>
                    <TD><span className="text-[11px] text-ink-muted">{fmtFull(b.dutyStreakStartedAt)}</span></TD>
                    <TD>
                      {b.acknowledgedAt ? (
                        <span className="text-[11px] text-green-700">{fmtFull(b.acknowledgedAt)}</span>
                      ) : b.level === 'alert' ? (
                        <Badge tone="warning">Driver never saw it</Badge>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </TD>
                    <TD>
                      {channels.length === 0 ? (
                        <Badge tone="danger" icon={BellOff}>
                          <span title="Alert was created but never reached the driver">Not delivered</span>
                        </Badge>
                      ) : (
                        <span className="inline-flex gap-1 flex-wrap">
                          {channels.map(c => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt border border-line text-ink-muted">
                              {c}
                            </span>
                          ))}
                        </span>
                      )}
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
