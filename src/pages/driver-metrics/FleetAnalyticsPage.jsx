import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Trophy, ShieldCheck, Activity, MapPin, Users } from 'lucide-react';
import { getLiveMapSummary } from '../../api/opsApi.js';
import { Button, Tabs } from '../../components/ui';
import FleetSummaryTab from './fleet/FleetSummaryTab.jsx';
import LeaderboardTab  from './fleet/LeaderboardTab.jsx';
import ComplianceTab   from './fleet/ComplianceTab.jsx';

const TABS = [
  { value: 'summary',     label: 'Fleet summary',    icon: Activity },
  { value: 'leaderboard', label: 'Leaderboard',      icon: Trophy },
  { value: 'compliance',  label: 'Break compliance', icon: ShieldCheck },
];

export default function FleetAnalyticsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = TABS.some(t => t.value === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'summary';

  const setTab = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'summary') next.delete('tab'); else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  const [includeTest, setIncludeTest] = useState(false);
  const [cities, setCities] = useState([]);

  // There is no city master endpoint in this module — the live-map summary's
  // byCity block is the closest thing, and it already carries live counts.
  useEffect(() => {
    let cancelled = false;
    getLiveMapSummary({ includeTest: true })
      .then(res => { if (!cancelled) setCities(res.data?.data?.byCity || []); })
      .catch(() => { /* city filter just stays at "All cities" */ });
    return () => { cancelled = true; };
  }, []);

  const cityOpts = useMemo(() => ([
    { value: '', label: 'All cities' },
    ...cities.map(c => ({ value: String(c.cityId), label: c.cityName })),
  ]), [cities]);

  return (
    <div className="max-w-[1500px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-accent-navy flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-700" /> Fleet Analytics
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">Supply, ranking and break compliance</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="accent-accent-navy"
            />
            Include test users
          </label>
          <Button variant="outline" size="sm" icon={Users} onClick={() => navigate('/driver-metrics')}>
            <span className="hidden sm:inline">All drivers</span>
          </Button>
          <Button variant="outline" size="sm" icon={MapPin} onClick={() => navigate('/driver-metrics/map')}>
            <span className="hidden sm:inline">Live map</span>
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'summary'     && <FleetSummaryTab includeTest={includeTest} />}
      {tab === 'leaderboard' && <LeaderboardTab includeTest={includeTest} cityOpts={cityOpts} />}
      {/* break-compliance has no includeTest param — it is a safety report over everyone */}
      {tab === 'compliance'  && <ComplianceTab />}
    </div>
  );
}
