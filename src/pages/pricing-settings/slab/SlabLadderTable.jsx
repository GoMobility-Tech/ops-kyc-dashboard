import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Table, THead, TBody, TH, TR, TD } from '../../../components/ui';
import { COMPONENTS, COMPONENT_LABEL, FLOOR, kmLabel, describeCell, num, plain } from './slabModel.js';

// Read-only view of a ladder: one row per distance range, one column per fare
// component. Each cell is "what it is" in large type and "how it is worked out"
// underneath, so ₹32 reads as "40% of ₹80" without anyone doing sums.
export default function SlabLadderTable({ ladder }) {
  const last = ladder[ladder.length - 1];
  const closedAt = last && num(last.to) !== null ? plain(last.to) : null;
  // Minimum fare is optional — its column only appears for sets that use it.
  const hasFloor = ladder.some(r => r.cells[FLOOR]?.mode === 'fixed');
  const cols = hasFloor ? [...COMPONENTS, FLOOR] : COMPONENTS;

  return (
    <Table>
      <THead>
        <tr>
          <TH>Trip distance</TH>
          {cols.map(c => <TH key={c}>{COMPONENT_LABEL[c]}</TH>)}
        </tr>
      </THead>
      <TBody>
        {ladder.map((row, i) => (
          <TR key={row.id} hover={false}>
            <TD className="whitespace-nowrap">
              <span className="inline-flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-semibold text-ink tabular-nums">{kmLabel(row)}</span>
              </span>
            </TD>
            {cols.map(c => {
              const d = describeCell(row.cells[c], c);
              return (
                <TD key={c}>
                  <div className={`font-semibold tabular-nums ${d.main === '—' ? 'text-ink-faint' : 'text-ink'}`}>{d.main}</div>
                  <div className="text-[10px] text-ink-faint">{d.sub}</div>
                </TD>
              );
            })}
          </TR>
        ))}
        {closedAt !== null && (
          <TR hover={false}>
            <td colSpan={cols.length + 1} className="px-3 py-2.5 text-ink-muted text-xs">
              <span className="inline-flex items-center gap-1.5">
                <ArrowRight size={12} /> Beyond {closedAt} km the old pricing engine is used.
              </span>
            </td>
          </TR>
        )}
      </TBody>
    </Table>
  );
}
