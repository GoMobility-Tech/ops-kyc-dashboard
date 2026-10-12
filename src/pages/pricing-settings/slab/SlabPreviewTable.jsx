import React from 'react';
import { Table, THead, TBody, TH, TR, TD, Alert } from '../../../components/ui';
import { riderTotal, previewWarnings, money } from './slabModel.js';

// "What does this set actually charge?" — the backend runs the real engine over a
// list of distances. The last column is what the rider pays with GST, before
// surge, coupons and subscriber discounts, so the number can be compared with
// the founder's sheet.
export default function SlabPreviewTable({ preview, gst, errors = [] }) {
  const rows = preview || [];
  const notes = previewWarnings(rows, gst);

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <Alert tone="danger" title="This set is not valid yet">
          <ul className="list-disc ml-4 space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Alert>
      )}
      {notes.map((n, i) => (
        <Alert key={i} tone="warning">{n.text}</Alert>
      ))}
      {errors.length === 0 && notes.length === 0 && rows.length > 0 && (
        <Alert tone="success">No gaps, and the rider&rsquo;s fare never drops as the trip gets longer.</Alert>
      )}

      <Table>
        <THead>
          <tr>
            <TH align="right">Trip km</TH>
            <TH align="right">Base</TH>
            <TH align="right">Distance</TH>
            <TH align="right">Conv. fee</TH>
            <TH align="right">Driver fare</TH>
            <TH align="right">Rider pays ≈</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map(r => (
            <TR key={r.km} hover={false}>
              <TD align="right" className="font-semibold tabular-nums">{r.km}</TD>
              {r.ok ? (
                <>
                  <TD align="right" className="tabular-nums">{money(r.base)}</TD>
                  <TD align="right" className="tabular-nums">{money(r.distance)}</TD>
                  <TD align="right" className="tabular-nums">{money(r.conv)}</TD>
                  <TD align="right" className="tabular-nums text-ink-muted">{money(r.rideFare)}</TD>
                  <TD align="right" className="tabular-nums font-bold text-accent-navy">{money(riderTotal(r, gst))}</TD>
                </>
              ) : (
                <td colSpan={5} className="px-3 py-3 text-right text-xs text-ink-faint">not covered — old pricing engine</td>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="text-[10px] text-ink-faint leading-relaxed">
        Rider pays ≈ driver fare + convenience fee, with GST on both. Surge, coupons, tolls and
        subscriber discounts come on top. Driver fare is base + distance.
      </p>
    </div>
  );
}
