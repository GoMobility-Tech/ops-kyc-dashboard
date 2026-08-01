import React, { useState, useRef } from 'react';

/**
 * Small, dependency-free charts for the ops dashboard.
 *
 * Deliberately single-series: two measures on one plot would need two y-scales,
 * which makes the crossing point meaningless. Stack two charts sharing an x-axis
 * instead (see the Daily tab).
 */

const AXIS_TEXT = 'text-[9px] text-ink-faint tabular-nums';

// Round the top of the axis up to something a human would pick, so the highest
// gridline is a readable number rather than "7.43".
function niceMax(raw) {
  if (!isFinite(raw) || raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

function Tooltip({ x, children }) {
  // Nudged toward the centre near the edges so it never spills out of the card.
  const shift = x < 15 ? '0%' : x > 85 ? '-100%' : '-50%';
  return (
    <div
      className="absolute z-20 pointer-events-none -top-1 rounded-lg bg-accent-navy text-white px-2.5 py-1.5 shadow-pop
        text-[10px] leading-relaxed whitespace-nowrap"
      style={{ left: `${x}%`, transform: `translate(${shift}, -100%)` }}
    >
      {children}
    </div>
  );
}

function Grid({ max, format }) {
  return (
    <>
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        <div className="border-t border-line" />
        <div className="border-t border-line" />
        <div className="border-t border-line" />
      </div>
      <div className={`absolute -left-1 inset-y-0 -translate-x-full flex flex-col justify-between items-end ${AXIS_TEXT}`}>
        <span className="-translate-y-1/2">{format(max)}</span>
        <span className="-translate-y-1/2">{format(max / 2)}</span>
        <span className="-translate-y-1/2">0</span>
      </div>
    </>
  );
}

function XLabels({ data, every }) {
  return (
    <div className="flex mt-1 h-3.5">
      {data.map((d, i) => (
        <div key={i} className="flex-1 min-w-0 relative">
          {i % every === 0 && (
            <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${AXIS_TEXT}`}>
              {d.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ text, height }) {
  return (
    <div className="flex items-center justify-center text-xs text-ink-faint border border-dashed border-line rounded-lg"
      style={{ height }}>
      {text}
    </div>
  );
}

/**
 * Vertical bars.
 *
 * data: [{ label, value, tooltip? }] — zero-value entries are kept and drawn as
 * a hairline, because a missing bar and a zero bar mean different things.
 */
export function BarChart({
  data = [],
  height = 170,
  color = '#062154',
  format = (v) => String(Math.round(v)),
  emptyText = 'No data',
  yGutter = 34,
}) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <Empty text={emptyText} height={height} />;

  const max = niceMax(Math.max(...data.map(d => d.value || 0)));
  const every = Math.max(1, Math.ceil(data.length / 12));
  const h = data[hover];

  return (
    <div className="w-full" style={{ paddingLeft: yGutter }}>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <Grid max={max} format={format} />

        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              className="flex-1 min-w-0 h-full flex items-end cursor-default"
            >
              <div
                className="w-full rounded-t transition-opacity"
                style={{
                  height: `${Math.max(((d.value || 0) / max) * 100, d.value ? 1.5 : 0.6)}%`,
                  background: color,
                  opacity: hover == null || hover === i ? 1 : 0.45,
                }}
              />
            </div>
          ))}
        </div>

        {h && (
          <Tooltip x={((hover + 0.5) / data.length) * 100}>
            {h.tooltip ?? <><b>{h.label}</b> · {format(h.value || 0)}</>}
          </Tooltip>
        )}
      </div>
      <XLabels data={data} every={every} />
    </div>
  );
}

/**
 * Line + soft area, sized for long series (a week of hourly points is 168).
 *
 * The SVG is stretched with preserveAspectRatio="none" so the geometry follows
 * the container width; non-scaling-stroke keeps the line 2px regardless.
 */
export function LineChart({
  data = [],
  height = 200,
  color = '#062154',
  fill = 'rgba(6, 33, 84, 0.10)',
  format = (v) => String(Math.round(v)),
  emptyText = 'No data',
  peakIndex = null,
  yGutter = 34,
}) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  if (!data.length) return <Empty text={emptyText} height={height} />;

  const max = niceMax(Math.max(...data.map(d => d.value || 0)));
  const every = Math.max(1, Math.ceil(data.length / 8));
  const n = data.length;

  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v) => 100 - ((v || 0) / max) * 100;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');

  const onMove = (e) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const ratio = (e.clientX - box.left) / box.width;
    setHover(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
  };

  const h = data[hover];

  return (
    <div className="w-full" style={{ paddingLeft: yGutter }}>
      <div
        ref={ref}
        className="relative"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <Grid max={max} format={format} />

        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={`0,100 ${pts} 100,100`} fill={fill} />
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {peakIndex != null && data[peakIndex] && (
            <line
              x1={x(peakIndex)} x2={x(peakIndex)} y1="0" y2="100"
              stroke="#a97c2f" strokeWidth="1.5" strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hover != null && (
            <line
              x1={x(hover)} x2={x(hover)} y1="0" y2="100"
              stroke="#062154" strokeWidth="1" strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Marker is a plain div so the stretched viewBox can't turn it into an ellipse. */}
        {h && (
          <div
            className="absolute w-2 h-2 rounded-full border-2 border-white pointer-events-none"
            style={{
              background: color,
              left: `${x(hover)}%`,
              top: `${y(h.value)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
        {h && (
          <Tooltip x={x(hover)}>
            {h.tooltip ?? <><b>{h.label}</b> · {format(h.value || 0)}</>}
          </Tooltip>
        )}
      </div>
      <XLabels data={data} every={every} />
    </div>
  );
}

/**
 * Single-hue intensity strip — magnitude across a fixed set of buckets
 * (hour of day, day of week). Light → dark, one hue, no rainbow.
 */
export function Heatstrip({
  data = [],           // [{ label, value, tooltip? }]
  color = '6, 33, 84', // rgb triplet — opacity carries the magnitude
  format = (v) => String(v),
  emptyText = 'No data',
}) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <Empty text={emptyText} height={64} />;

  const max = Math.max(1, ...data.map(d => d.value || 0));
  const h = data[hover];

  return (
    <div className="relative">
      <div className="flex gap-[2px]">
        {data.map((d, i) => {
          const v = d.value || 0;
          // Floor the alpha so a non-zero bucket never reads as empty.
          const alpha = v === 0 ? 0 : 0.15 + 0.85 * (v / max);
          return (
            <div key={i} className="flex-1 min-w-0" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div
                className="h-9 rounded border border-line"
                style={{ background: v === 0 ? 'transparent' : `rgba(${color}, ${alpha})` }}
              />
              <p className={`text-center mt-0.5 truncate ${AXIS_TEXT}`}>{d.label}</p>
            </div>
          );
        })}
      </div>
      {h && (
        <Tooltip x={((hover + 0.5) / data.length) * 100}>
          {h.tooltip ?? <><b>{h.label}</b> · {format(h.value || 0)}</>}
        </Tooltip>
      )}
    </div>
  );
}
