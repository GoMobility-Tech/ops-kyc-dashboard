import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronDown, OctagonPause, AlarmClock } from 'lucide-react';
import { getBreakCompliance } from '../../../api/opsApi.js';
import {
  Card, Alert, Spinner, EmptyState, Button, Badge,
  Table, THead, TBody, TH, TR, TD, DateRangeFilter, ROLLING_PRESETS,
} from '../../../components/ui';
import { defaultRange, MAX_RANGE_DAYS, fmtDur, fmtFull, fmtNum, apiError } from '../metricsMeta.js';

const PAGE = 50;

/**
 * Safety report, not a punishment list. Rows are drivers who ran long stretches
 * without a break — the framing everywhere here is "these drivers are running
 * long stretches", never "these drivers are breaking the rules".
 */
export default function ComplianceTab() {
  const navigate = useNavigate();
  const [range, setRange] = useState(() => defaultRange(30));
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore]   = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ offset = 0, append = false } = {}) => {
    append ? setMore(true) : setLoading(true);
    try {
      const res = await getBreakCompliance({ ...range, limit: PAGE, offset });
      const d = res.data?.data || {};
      setItems(prev => (append ? [...prev, ...(d.items || [])] : (d.items || [])));
      setTotal(d.total || 0);
      setError('');
    } catch (e) {
      setError(apiError(e, 'Failed to load break compliance'));
    } finally {
      setLoading(false); setMore(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const forced = items.filter(i => (i.forceOfflineCount || 0) > 0).length;

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

      <Alert tone="info" title="This is a safety report">
        These drivers are running long stretches without a break. It is not a list to punish
        anyone with — it exists so someone talks to them before fatigue causes an accident.
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={22} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No break violations"
          description="Everyone stayed within the break rules in this range."
        />
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">
            Showing {items.length} of {total}
            {forced > 0 && <span className="text-red-600"> · {forced} drivers had to be taken offline automatically</span>}
          </p>

          <Table>
            <THead>
              <tr>
                <TH>Driver</TH>
                <TH align="right">Alerts</TH>
                <TH align="right">Auto offline</TH>
                <TH align="right">Longest stretch</TH>
                <TH>Last event</TH>
              </tr>
            </THead>
            <TBody>
              {/* Already sorted server-side: forceOfflineCount DESC, then alertCount DESC. */}
              {items.map(r => {
                const hot = (r.forceOfflineCount || 0) > 0;
                return (
                  <TR
                    key={r.driverId}
                    onClick={() => navigate(`/driver-metrics/drivers/${r.driverId}?tab=breaks`)}
                    className={hot ? 'bg-red-50/60' : undefined}
                  >
                    <TD className="max-w-[260px]">
                      <p className="text-xs font-semibold text-ink truncate">{r.name || `Driver #${r.driverId}`}</p>
                      <p className="text-[11px] text-ink-muted truncate">{r.phone}</p>
                    </TD>
                    <TD align="right">
                      <Badge tone={r.alertCount > 0 ? 'warning' : 'neutral'} icon={AlarmClock}>
                        {fmtNum(r.alertCount, '0')}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <Badge tone={hot ? 'danger' : 'neutral'} icon={OctagonPause}>
                        {fmtNum(r.forceOfflineCount, '0')}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <span className={`text-xs font-semibold tabular-nums ${hot ? 'text-red-700' : 'text-ink'}`}>
                        {fmtDur(r.maxContinuousLabel, r.maxContinuousSeconds)}
                      </span>
                    </TD>
                    <TD><span className="text-[11px] text-ink-muted">{fmtFull(r.lastEventAt)}</span></TD>
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
