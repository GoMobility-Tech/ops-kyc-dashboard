import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Phone, Clock, UserX, Radio, Waypoints,
  CheckCircle2, XCircle, CircleSlash, PhoneCall,
} from 'lucide-react';
import { getRideDispatch } from '../../api/opsApi.js';
import {
  Card, CardHeader, Badge, Button, Alert, Spinner, EmptyState, StatTile,
} from '../../components/ui';
import OfferTimeline, { CallList } from './OfferTimeline.jsx';
import {
  num, fmtKm, fmtWait, fmtRupees, fmtTime, waitTone, waitLabel, isSearching,
  telHref, pendingOffers,
} from './dispatchMeta.js';

function Field({ label, value, mono = false }) {
  const empty = value == null || value === '';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</p>
      <p className={`text-xs font-medium break-words leading-snug
        ${empty ? 'text-ink-faint' : 'text-ink'} ${mono ? 'font-mono' : ''}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

export default function RideDispatchPage() {
  const { rideId } = useParams();
  const nav = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // No auto-poll on the detail screen — this is where someone stops to read and
  // make calls, and rows shifting underneath them breaks that. Refresh is manual.
  const fetchDetail = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getRideDispatch(rideId);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the dispatch detail');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const back = (
    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav('/dispatch')}>
      Live requests
    </Button>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
        {back}
        <div className="py-16 flex justify-center"><Spinner size={24} /></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
        {back}
        <Alert tone="danger">{error || 'Ride not found'}</Alert>
      </div>
    );
  }

  const { ride, dispatch, summary, offers } = data;
  const waiting   = pendingOffers(offers);
  const tel       = telHref(ride.passenger?.phone);
  const noOffers  = (summary?.total ?? 0) === 0;
  const searching = isSearching(ride.status);
  const tone      = waitTone(ride.waiting_minutes, ride.status);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {back}
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchDetail}>
          Refresh
        </Button>
      </div>

      {/* ── The ride ── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-mono">{ride.ride_number || `Ride ${ride.id}`}</span>
              <Badge tone={ride.status === 'requested' ? 'warning' : 'neutral'}>
                {ride.status}
              </Badge>
              <Badge tone="neutral">{ride.vehicle_type}</Badge>
            </span>
          }
          subtitle={`Booked ${fmtTime(ride.requested_at)}`}
          right={
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                {waitLabel(ride.status)}
              </p>
              <p className={`text-2xl font-bold tabular-nums leading-tight ${
                { danger: 'text-red-600', warning: 'text-amber-700' }[tone] || 'text-ink'
              }`}>
                {fmtWait(ride.waiting_minutes)}
              </p>
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
              Passenger
            </p>
            <p className="text-sm font-medium text-ink truncate">
              {ride.passenger?.name || 'Unknown'}
            </p>
            {tel ? (
              <a
                href={tel}
                className="text-xs text-accent-navy hover:text-brand-700 font-semibold inline-flex items-center gap-1 mt-0.5"
              >
                <Phone size={11} />{ride.passenger.phone}
              </a>
            ) : (
              <span className="text-xs text-ink-faint">No phone</span>
            )}
          </div>
          <Field label="Estimated fare" value={fmtRupees(ride.estimated_fare)} />
          <div className="lg:col-span-2 space-y-1.5">
            <p className="text-xs text-ink leading-snug">
              <span className="text-green-700 font-bold">●</span> {ride.pickup_address || '—'}
            </p>
            <p className="text-xs text-ink-muted leading-snug">
              <span className="text-red-600 font-bold">●</span> {ride.dropoff_address || '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Headline: how many were reached, and what they did ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Notified" value={summary.total} icon={Radio} tone="navy"
          sub="drivers in total" />
        <StatTile label="No response" value={summary.pending} icon={Clock}
          tone={summary.pending ? 'warning' : 'neutral'}
          hint="No response yet — these are the ones to call"
          sub="call these" />
        <StatTile label="Rejected" value={summary.rejected} icon={XCircle}
          tone={summary.rejected ? 'danger' : 'neutral'}
          sub="declined" />
        <StatTile label="Expired" value={summary.expired} icon={CircleSlash}
          hint="Another driver took the ride, or the ride expired"
          sub="missed the window" />
        <StatTile label="Accepted" value={summary.accepted} icon={CheckCircle2}
          tone={summary.accepted ? 'success' : 'neutral'}
          sub="took the ride" />
      </div>

      {/* ── The actual job: call these drivers ── */}
      {!searching && (
        <Alert tone="info">
          This ride is <strong>{ride.status}</strong> — it is no longer looking for a driver.
          Everything below is history; there is nobody to call.
        </Alert>
      )}

      {searching && waiting.length > 0 && (
        <Card padding="sm" className="border-amber-200 bg-amber-50/40">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <PhoneCall size={15} className="text-amber-700" />
                Call these {waiting.length} driver{waiting.length === 1 ? '' : 's'}
              </span>
            }
            subtitle="They never responded either way — nobody declined. This is the shortest path to getting this passenger a ride."
          />
          <div className="mt-3">
            <CallList offers={waiting} />
          </div>
        </Card>
      )}

      {/* ── The full sequence ── */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 pb-3">
          <CardHeader
            title="Dispatch timeline"
            subtitle="The order the requests went out — top to bottom"
          />
        </div>

        {noOffers ? (
          <div className="px-4 pb-4">
            <EmptyState
              icon={UserX}
              title="No driver was sent this ride"
              description="This is not an error. It means no eligible driver was online in that area at the time — a supply problem rather than a dispatch one, and there is nobody here to call."
            />
          </div>
        ) : (
          <OfferTimeline offers={offers} />
        )}
      </Card>

      {/* ── What dispatch actually tried ── */}
      <Card padding="sm">
        <CardHeader
          title={<span className="flex items-center gap-2"><Waypoints size={15} />Dispatch attempts</span>}
          subtitle="How many times, and how far out, the backend searched"
        />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Field label="Attempts" value={dispatch.attempts ?? '—'} />
          <Field label="Current radius" value={fmtKm(dispatch.current_radius_km)} />
          <Field label="Final radius" value={fmtKm(dispatch.final_radius_km)} />
          <Field label="Match source" value={dispatch.match_source} />
          <Field label="First broadcast" value={fmtTime(dispatch.first_broadcast_at)} />
          <Field label="Matched at" value={fmtTime(dispatch.matched_at)} />
        </div>

        {num(dispatch.drivers_notified_total) != null
          && num(dispatch.drivers_notified_total) !== summary.total && (
          <Alert tone="info" className="mt-3">
            Analytics counts <strong>{dispatch.drivers_notified_total}</strong> while the list above
            shows <strong>{summary.total}</strong>. That is expected — analytics is written once on
            the first broadcast, whereas the list above also picks up ring expansion and drivers who
            came online later. The list above is the accurate one.
          </Alert>
        )}
      </Card>
    </div>
  );
}
