import React from 'react';
import { Phone, Car, ArrowRight } from 'lucide-react';
import { Badge, Table, THead, TBody, TH, TR, TD } from '../../components/ui';
import { sourceMeta, outcomeMeta, fmtKm, fmtClock, telHref } from './dispatchMeta.js';

// One offer = one (ride, driver) pair. The backend already returns them in
// notified_at ASC — that IS the dispatch sequence, so never re-sort here.

function DriverCell({ driver }) {
  const name = driver?.name || 'Unknown';
  const tel  = telHref(driver?.phone);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-full bg-accent-navy text-brand-400 font-bold text-xs flex items-center justify-center shrink-0 ring-1 ring-brand-500/40">
        {name[0].toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-ink font-medium text-sm truncate max-w-[180px]">{name}</p>
        {tel ? (
          <a
            href={tel}
            className="text-[11px] text-accent-navy hover:text-brand-700 font-semibold inline-flex items-center gap-1"
          >
            <Phone size={9} />{driver.phone}
          </a>
        ) : (
          <span className="text-[11px] text-ink-faint">No phone</span>
        )}
      </div>
    </div>
  );
}

function VehicleCell({ driver }) {
  if (!driver?.vehicle_number && !driver?.vehicle_type) {
    return <span className="text-[11px] text-ink-faint">—</span>;
  }
  return (
    <div className="min-w-0">
      <p className="text-xs font-mono font-semibold text-ink truncate">
        {driver.vehicle_number || '—'}
      </p>
      <p className="text-[11px] text-ink-muted truncate">
        {driver.vehicle_type || '—'}
        {driver.vehicle_model ? ` · ${driver.vehicle_model}` : ''}
      </p>
    </div>
  );
}

function SourceCell({ offer }) {
  const meta = sourceMeta(offer.source);
  const Icon = meta.icon;
  // tier and radius only exist for ring expansion; both are null for
  // late_online, where showing 0 would be a lie.
  const hasRing = offer.tier != null;
  return (
    <div className="space-y-1">
      <Badge tone={meta.tone} icon={Icon} className="cursor-help">
        <span title={meta.why}>{meta.label}</span>
      </Badge>
      <p className="text-[10px] text-ink-faint tabular-nums">
        {hasRing ? `tier ${offer.tier}` : 'no tier'}
        {offer.radius_km != null ? ` · ${fmtKm(offer.radius_km)}` : ''}
      </p>
    </div>
  );
}

export default function OfferTimeline({ offers = [] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>#</TH>
          <TH>Driver</TH>
          <TH>Vehicle</TH>
          <TH>Reached via</TH>
          <TH>Distance</TH>
          <TH>Notified</TH>
          <TH>Response</TH>
        </tr>
      </THead>
      <TBody>
        {offers.map((o, i) => {
          const out  = outcomeMeta(o.outcome);
          const Icon = out.icon;
          const isPending = o.outcome === 'pending';
          return (
            <TR
              key={`${o.driver?.id}-${o.notified_at}`}
              hover={false}
              className={isPending ? 'bg-amber-50/60' : ''}
            >
              <TD>
                <span className="text-[11px] font-bold text-ink-faint tabular-nums">{i + 1}</span>
              </TD>
              <TD><DriverCell driver={o.driver} /></TD>
              <TD><VehicleCell driver={o.driver} /></TD>
              <TD><SourceCell offer={o} /></TD>
              <TD>
                <span className="text-xs text-ink tabular-nums">{fmtKm(o.distance_km)}</span>
              </TD>
              <TD>
                <span className="text-[11px] text-ink-muted tabular-nums whitespace-nowrap">
                  {fmtClock(o.notified_at)}
                </span>
              </TD>
              <TD>
                <div className="space-y-1">
                  <Badge tone={out.tone} icon={Icon} className="cursor-help">
                    <span title={out.why}>{out.label}</span>
                  </Badge>
                  {o.outcome_at && (
                    <p className="text-[10px] text-ink-faint tabular-nums flex items-center gap-0.5">
                      <ArrowRight size={9} />{fmtClock(o.outcome_at)}
                    </p>
                  )}
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

// Large call cards for the drivers who have not responded yet. This is the
// real output of the whole module — these are the people support rings.
export function CallList({ offers = [] }) {
  if (offers.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {offers.map((o) => {
        const tel = telHref(o.driver?.phone);
        return (
          <div
            key={o.driver?.id}
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3"
          >
            <span className="w-10 h-10 rounded-full bg-accent-navy text-brand-400 font-bold text-sm flex items-center justify-center shrink-0 ring-1 ring-brand-500/40">
              {(o.driver?.name || '?')[0].toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">
                {o.driver?.name || 'Unknown'}
              </p>
              <p className="text-[11px] text-ink-muted flex items-center gap-1 truncate">
                <Car size={10} className="shrink-0" />
                {o.driver?.vehicle_number || '—'}
                {o.distance_km != null ? ` · ${fmtKm(o.distance_km)} away` : ''}
              </p>
              {tel ? (
                <a
                  href={tel}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-navy text-white text-xs font-semibold hover:bg-accent-navyMid transition"
                >
                  <Phone size={12} />{o.driver.phone}
                </a>
              ) : (
                <p className="mt-2 text-[11px] text-ink-faint">No phone number on file</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
