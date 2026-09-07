import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, ChevronRight, RefreshCw, Phone, Clock, UserX, Pause, Play, MapPin,
} from 'lucide-react';
import { getPendingDispatch } from '../../api/opsApi.js';
import {
  Button, Card, Badge, EmptyState, Spinner, Alert, StatTile,
  Table, THead, TBody, TH, TR, TD,
} from '../../components/ui';
import {
  num, fmtWait, waitTone, fmtRupees, telHref, fmtClock, WAIT_CRIT_MIN,
} from './dispatchMeta.js';

// This is a live board — support needs to see a ride the moment it is
// requested, not once it has been stuck for a while. A ride only stays in
// `requested` for about two minutes before it matches or expires, so slow
// polling can miss one entirely. The query is an indexed status lookup on an
// admin-only route, so 10s is cheap.
const REFRESH_MS = 10000;
const LIMIT = 100;

// Show the wait as a state, not just a number — this column gets scanned,
// not read.
function WaitCell({ minutes }) {
  const tone = waitTone(minutes);
  const styles = {
    danger:  'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-surface-alt text-ink-muted border-line',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border
      text-xs font-bold tabular-nums ${styles}`}>
      <Clock size={11} />{fmtWait(minutes)}
    </span>
  );
}

function RideRow({ row, onOpen }) {
  const offers = num(row.offers_recorded) ?? 0;
  const noOffers = offers === 0;
  const tel = telHref(row.passenger_phone);

  return (
    <TR onClick={onOpen} className={noOffers ? 'bg-red-50/40' : ''}>
      <TD><WaitCell minutes={row.waiting_minutes} /></TD>

      <TD>
        <p className="text-ink font-medium text-sm truncate max-w-[170px]">
          {row.passenger_name || 'Unknown'}
        </p>
        {tel ? (
          <a
            href={tel}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-accent-navy hover:text-brand-700 font-medium inline-flex items-center gap-1"
          >
            <Phone size={9} />{row.passenger_phone}
          </a>
        ) : (
          <span className="text-[11px] text-ink-faint">No phone</span>
        )}
      </TD>

      <TD>
        <div className="max-w-[300px] space-y-0.5">
          <p className="text-[11px] text-ink truncate" title={row.pickup_address}>
            <span className="text-green-700 font-bold">●</span> {row.pickup_address || '—'}
          </p>
          <p className="text-[11px] text-ink-muted truncate" title={row.dropoff_address}>
            <span className="text-red-600 font-bold">●</span> {row.dropoff_address || '—'}
          </p>
        </div>
      </TD>

      <TD>
        <Badge tone="neutral">{row.vehicle_type || '—'}</Badge>
        <p className="text-[11px] text-ink-muted mt-1 tabular-nums">
          {fmtRupees(row.estimated_fare)}
        </p>
      </TD>

      <TD>
        {noOffers ? (
          <Badge tone="danger" icon={UserX}>Reached nobody</Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-lg font-bold text-accent-navy tabular-nums leading-none">
              {offers}
            </span>
            <span className="text-[10px] text-ink-muted leading-tight">
              driver{offers === 1 ? '' : 's'}<br />notified
            </span>
          </span>
        )}
      </TD>

      <TD align="right">
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onOpen}
            title="See which drivers were notified"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent-navy text-white text-[11px] font-semibold hover:bg-accent-navyMid transition"
          >
            Drivers <ChevronRight size={12} />
          </button>
        </div>
      </TD>
    </TR>
  );
}

export default function DispatchPage() {
  const nav = useNavigate();
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [live,    setLive]    = useState(true);
  const [lastAt,  setLastAt]  = useState(null);

  // A background refresh must never blank the table — that breaks whoever is
  // mid-scan. Only the very first load shows a spinner.
  const firstLoad = useRef(true);

  const fetchList = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    try {
      const res = await getPendingDispatch({ limit: LIMIT });
      setRows(res.data?.data?.rides || []);
      setLastAt(new Date().toISOString());
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load ride requests');
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchList, REFRESH_MS);
    return () => clearInterval(id);
  }, [live, fetchList]);

  const waits    = rows.map(r => num(r.waiting_minutes) ?? 0);
  const longest  = waits.length ? Math.max(...waits) : 0;
  const critical = waits.filter(m => m >= WAIT_CRIT_MIN).length;
  const zeroSent = rows.filter(r => (num(r.offers_recorded) ?? 0) === 0).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">Live Ride Requests</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Every ride appears here the moment a passenger books it, and stays until a
            driver is found. Longest wait first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastAt && (
            <span className="text-[10px] text-ink-faint tabular-nums hidden sm:block">
              Updated {fmtClock(lastAt)}
            </span>
          )}
          <Button
            variant={live ? 'secondary' : 'outline'}
            size="sm"
            icon={live ? Pause : Play}
            onClick={() => setLive(v => !v)}
            title={live ? `Refreshing every ${REFRESH_MS / 1000}s` : 'Auto-refresh is off'}
          >
            {live ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchList}>
            Refresh
          </Button>
        </div>
      </div>

      <Alert tone="info">
        New requests show up here immediately and drop off on their own once a driver
        accepts or the ride expires. This screen is <strong>read-only</strong> — rides are
        not assigned from here. The workflow is: open a ride, see which drivers were
        notified, and <strong>call the ones who have not responded</strong>.
      </Alert>

      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Live requests" value={rows.length} icon={Radio} tone="navy"
            hint="Rides currently searching for a driver"
            sub="searching for a driver"
          />
          <StatTile
            label="Longest wait" value={fmtWait(longest)} icon={Clock}
            tone={waitTone(longest)}
            sub="the ride at the top"
          />
          <StatTile
            label={`Waiting ${WAIT_CRIT_MIN}+ min`} value={critical} icon={Clock}
            tone={critical ? 'danger' : 'neutral'}
            hint="The full dispatch cycle came up empty — start here"
            sub="look at these first"
          />
          <StatTile
            label="Reached nobody" value={zeroSent} icon={UserX}
            tone={zeroSent ? 'warning' : 'neutral'}
            hint="No eligible driver was online in that area — a supply problem, not a dispatch one"
            sub="no driver in the area"
          />
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No ride requests right now"
          description={
            live
              ? `The next ride a passenger books will appear here on its own — no need to refresh (checked every ${REFRESH_MS / 1000}s).`
              : 'Auto-refresh is off. Switch "Paused" back to Live, or hit Refresh, to see new requests.'
          }
        />
      ) : (
        <>
          {zeroSent > 0 && (
            <Alert tone="warning">
              <strong>{zeroSent}</strong> ride{zeroSent === 1 ? '' : 's'} reached{' '}
              <strong>no driver at all</strong> — there was no eligible driver online in that
              area. That is a supply problem rather than a dispatch one, and there is nobody
              to call for those rides.
            </Alert>
          )}

          <Table>
            <THead>
              <tr>
                <TH>Waiting</TH>
                <TH>Passenger</TH>
                <TH>Route</TH>
                <TH>Ride</TH>
                <TH>Notified</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map(row => (
                <RideRow
                  key={row.ride_id}
                  row={row}
                  onOpen={() => nav(`/dispatch/${row.ride_id}`)}
                />
              ))}
            </TBody>
          </Table>

          <p className="text-[11px] text-ink-faint px-1 flex items-center gap-1">
            <MapPin size={11} />
            Showing {rows.length} ride{rows.length === 1 ? '' : 's'}
            {rows.length === LIMIT && ` (first ${LIMIT})`}.
            {live && ` New requests appear within ${REFRESH_MS / 1000}s.`}
          </p>
        </>
      )}
    </div>
  );
}
