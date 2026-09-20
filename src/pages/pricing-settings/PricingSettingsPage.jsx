import React, { useState, useEffect, useCallback } from 'react';
import {
  Car, SlidersHorizontal, Receipt, Ruler, BadgeCheck, ShieldAlert, History,
  RefreshCw, Server, CheckCircle2,
} from 'lucide-react';
import { Tabs, Alert, Spinner, Button, Badge } from '../../components/ui';
import {
  getPricingVehicles, getPricingSettings, getPricingSettingsMeta,
  getPricingGst, getPricingTiers, getPricingSubscribers, getPricingPenalties,
  reloadPricingCache,
} from '../../api/opsApi.js';
import { cacheWarning, describeFailure } from './pricingMeta.js';

import VehiclesTab    from './VehiclesTab.jsx';
import SettingsTab    from './SettingsTab.jsx';
import GstTab         from './GstTab.jsx';
import TiersTab       from './TiersTab.jsx';
import SubscribersTab from './SubscribersTab.jsx';
import PenaltiesTab   from './PenaltiesTab.jsx';
import AuditTab       from './AuditTab.jsx';

// ─── Pricing Settings ───────────────────────────────────────────────────────
//
// The screen that decides what every rider is charged. Three things are built
// into its shape rather than left to each tab:
//
//   1. Everything loads in one pass. The tabs are views over one snapshot, so
//      switching between them never shows a spinner and never shows two tabs
//      disagreeing about the same number.
//
//   2. A save refetches. The backend recomputes derived values (the convenience
//      fee table, the audit row) and the only honest thing to show afterwards
//      is what the server now holds, not what was typed.
//
//   3. The cache warning is global, not per-form. When a write reports that the
//      other API servers could not be told, that is true for the whole screen
//      until someone reloads — so it stays up top with the button that fixes it.

const TABS = [
  { value: 'vehicles',    label: 'Vehicles',   icon: Car },
  { value: 'settings',    label: 'Settings',   icon: SlidersHorizontal },
  { value: 'gst',         label: 'GST',        icon: Receipt },
  { value: 'tiers',       label: 'Distance',   icon: Ruler },
  { value: 'subscribers', label: 'GO Pass',    icon: BadgeCheck },
  { value: 'penalties',   label: 'Penalties',  icon: ShieldAlert },
  { value: 'audit',       label: 'History',    icon: History },
];

export default function PricingSettingsPage() {
  const [tab, setTab]         = useState('vehicles');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [flash, setFlash]     = useState('');
  const [failures, setFailures]     = useState({});
  const [staleCache, setStaleCache] = useState('');
  const [reloading, setReloading]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Settled, not all-or-nothing. Several of these endpoints are admin-only
      // while the vehicle list is also open to ops, so a reader with partial
      // access should still get the tabs they are allowed to see rather than
      // an empty screen.
      const [vehicles, settings, meta, gst, tiers, subscribers, penalties] =
        await Promise.allSettled([
          getPricingVehicles(), getPricingSettings(), getPricingSettingsMeta(),
          getPricingGst(), getPricingTiers(), getPricingSubscribers(), getPricingPenalties(),
        ]);

      const ok = (r) => (r.status === 'fulfilled' ? r.value.data?.data : null);

      // A rejected section must SAY so — see describeFailure.
      const why = describeFailure;

      setData({
        vehicles:    ok(vehicles),
        settings:    ok(settings) || [],
        metaGroups:  ok(meta)?.groups || [],
        gst:         ok(gst) || {},
        tiers:       ok(tiers) || [],
        subscribers: ok(subscribers) || [],
        penalties:   ok(penalties) || [],
      });

      setFailures({
        vehicles:    why(vehicles),
        settings:    why(settings) || why(meta),
        gst:         why(gst),
        tiers:       why(tiers),
        subscribers: why(subscribers),
        penalties:   why(penalties),
      });

      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clear the success line on its own — it is a confirmation, not a message
  // that needs dismissing, and a stack of them buries the form.
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(''), 4000);
    return () => clearTimeout(id);
  }, [flash]);

  const onSaved = useCallback((res, message) => {
    setError('');
    setFlash(message);
    const warn = cacheWarning(res);
    if (warn) setStaleCache(warn);
    load();
  }, [load]);

  const onError = useCallback((message) => {
    setFlash('');
    setError(message);
  }, []);

  const reload = async () => {
    setReloading(true);
    try {
      const res = await reloadPricingCache();
      setStaleCache(cacheWarning(res) || '');
      setFlash(res.data?.message || 'Pricing reloaded');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reload');
    } finally {
      setReloading(false);
    }
  };

  const vehicleCount = data?.vehicles?.vehicles?.length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy">Pricing Settings</h2>
          <p className="text-xs text-ink-muted mt-0.5 max-w-2xl leading-relaxed">
            Everything here is live. A saved change applies to the next fare quote on
            every API server, and is recorded with your email in History.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {vehicleCount != null && <Badge tone="neutral">{vehicleCount} vehicles</Badge>}
          <Button variant="outline" size="sm" icon={Server} onClick={reload} loading={reloading}
                  title="Reload the fare engine from the database on every server">
            Reload cache
          </Button>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </div>
      </div>

      {staleCache && (
        <Alert tone="warning" title="Saved, but not on every server" onClose={() => setStaleCache('')}>
          {staleCache} Until then a quote answered by another server can still use the
          old number.
        </Alert>
      )}

      {flash && (
        <Alert tone="success" onClose={() => setFlash('')}>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {flash}
          </span>
        </Alert>
      )}

      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner /></div>
      ) : failures[tab] ? (
        <Alert tone="danger" title="This section did not load">
          {failures[tab]}
          <span className="block mt-1 opacity-80">
            Nothing is shown rather than an empty form — blank fields here would read
            as settings that are switched off.
          </span>
        </Alert>
      ) : (
        <>
          {tab === 'vehicles' && (
            <VehiclesTab data={data?.vehicles} tiers={data?.tiers} onSaved={onSaved} onError={onError} />
          )}
          {tab === 'settings' && (
            <SettingsTab
              settings={data?.settings}
              metaGroups={data?.metaGroups}
              onSaved={onSaved}
              onError={onError}
            />
          )}
          {tab === 'gst' && <GstTab gst={data?.gst} onSaved={onSaved} onError={onError} />}
          {tab === 'tiers' && <TiersTab tiers={data?.tiers} onSaved={onSaved} onError={onError} />}
          {tab === 'subscribers' && (
            <SubscribersTab subscribers={data?.subscribers} onSaved={onSaved} onError={onError} />
          )}
          {tab === 'penalties' && (
            <PenaltiesTab
              penalties={data?.penalties}
              onSaved={onSaved}
              onError={onError}
              onDeleted={onSaved}
            />
          )}
          {tab === 'audit' && <AuditTab />}
        </>
      )}
    </div>
  );
}
