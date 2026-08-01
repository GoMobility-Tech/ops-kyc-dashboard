import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, PowerOff, Star, Phone, MapPin, Clock, LayoutDashboard,
  ListChecks, BarChart3, CalendarDays, Route, Coffee, User,
} from 'lucide-react';
import { getDriverOverview } from '../../api/opsApi.js';
import { Button, Card, Alert, Spinner, Tabs, Badge } from '../../components/ui';
import {
  apiError, fmtDec, fmtMoney, fmtTime, isDisconnected, connectionMessage,
} from './metricsMeta.js';
import { StatusPill, ConnectionTag, DutyBadge, PendingOfflineBadge, TestTag, VehicleTypes } from './DriverBits.jsx';
import ForceOfflineModal, { forceOfflineToast } from './ForceOfflineModal.jsx';

import OverviewTab from './tabs/OverviewTab.jsx';
import SessionsTab from './tabs/SessionsTab.jsx';
import DailyTab    from './tabs/DailyTab.jsx';
import StatsTab    from './tabs/StatsTab.jsx';
import TimelineTab from './tabs/TimelineTab.jsx';
import TrailTab    from './tabs/TrailTab.jsx';
import BreaksTab   from './tabs/BreaksTab.jsx';

const TABS = [
  { value: 'overview', label: 'Overview',  icon: LayoutDashboard, Comp: OverviewTab },
  { value: 'sessions', label: 'Sessions',  icon: ListChecks,      Comp: SessionsTab },
  { value: 'daily',    label: 'Daily',     icon: CalendarDays,    Comp: DailyTab },
  { value: 'stats',    label: 'Stats',     icon: BarChart3,       Comp: StatsTab },
  { value: 'timeline', label: 'Timeline',  icon: Clock,           Comp: TimelineTab },
  { value: 'trail',    label: 'Trail',     icon: Route,           Comp: TrailTab },
  { value: 'breaks',   label: 'Breaks',    icon: Coffee,          Comp: BreaksTab },
];

function Avatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-14 h-14 rounded-xl bg-brand-200 text-brand-800 flex items-center justify-center shrink-0">
        <User size={22} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name || 'Driver'}
      onError={() => setFailed(true)}
      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-line"
    />
  );
}

export default function DriverDetailPage() {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = TABS.some(t => t.value === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setTab = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'overview') next.delete('tab'); else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  const [ov, setOv]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [toast, setToast]     = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await getDriverOverview(driverId);
      setOv(res.data?.data || null);
      setError('');
    } catch (e) {
      setError(apiError(e, e?.response?.status === 404 ? 'Driver not found' : 'Failed to load driver'));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [driverId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const Active = TABS.find(t => t.value === tab)?.Comp || OverviewTab;

  if (loading) {
    return <div className="py-24 flex justify-center"><Spinner size={26} /></div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load} loading={busy}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {ov && (
        <>
          {/* Header */}
          <Card className="space-y-3">
            <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
              <Avatar src={ov.photo} name={ov.name} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-accent-navy truncate">{ov.name || `Driver #${ov.driverId}`}</h2>
                  <TestTag show={ov.isTestUser} />
                  {ov.isVerified === false && <Badge tone="warning">Unverified</Badge>}
                  {ov.isActive === false && <Badge tone="danger">Inactive</Badge>}
                </div>

                <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1"><Phone size={11} /> {ov.phone || '—'}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={11} /> {ov.city?.name || '—'}</span>
                  {ov.rating != null && (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                      <Star size={11} className="fill-amber-500 text-amber-500" /> {fmtDec(ov.rating, 2)}
                    </span>
                  )}
                  <span>Lifetime {fmtMoney(ov.totalEarnings)}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <StatusPill status={ov.status} />
                  <ConnectionTag connection={ov.connection} />
                  <DutyBadge
                    seconds={ov.duty?.continuousSeconds}
                    label={ov.duty?.continuousLabel}
                    policy={ov.duty?.breakPolicy}
                  />
                  <PendingOfflineBadge show={ov.duty?.pendingForceOffline} reason={ov.duty?.pendingReason} />
                  <VehicleTypes types={ov.vehicle?.types || []} number={ov.vehicle?.number} />
                  {ov.vehicle?.model && <span className="text-[11px] text-ink-muted">{ov.vehicle.model}</span>}
                </div>
              </div>

              <div className="shrink-0 text-right space-y-1.5">
                <Button variant="danger" size="sm" icon={PowerOff} onClick={() => setOfflineOpen(true)}>
                  Force offline
                </Button>
                <p className="text-[10px] text-ink-faint">
                  Last ping {ov.lastPingAt ? fmtTime(ov.lastPingAt) : '—'}
                </p>
              </div>
            </div>

            {/* Backend-authored sentence, shown verbatim — it explains exactly
                why this driver reads "online" while their session is closed. */}
            {isDisconnected(ov.connection) && (
              <Alert tone="warning" title="Marked online, but the app is not responding">
                {connectionMessage(ov.connection)}
              </Alert>
            )}

            {ov.duty?.pendingForceOffline && (
              <Alert tone="warning" title="Break limit crossed — driver goes offline as soon as the ride ends">
                {ov.duty.pendingReason || 'The system will take this driver offline automatically once their current ride completes.'}
              </Alert>
            )}
          </Card>

          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          <Active driverId={driverId} overview={ov} onRefreshOverview={load} />
        </>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Alert tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Alert>
        </div>
      )}

      {offlineOpen && ov && (
        <ForceOfflineModal
          driver={ov}
          onClose={() => setOfflineOpen(false)}
          onDone={(r) => { setToast(forceOfflineToast(r)); load(); }}
        />
      )}
    </div>
  );
}
