// Map-pin glyphs, as raw SVG strings.
//
// Leaflet markers are built from an HTML string, not React, so the lucide
// components we use everywhere else can't be dropped in directly. These are the
// same lucide outlines (ISC licensed, lucide-react v0.511) transcribed as inner
// SVG so a pin can render without pulling react-dom/server into the bundle.
//
// Keep the viewBox at 24×24 and rely on currentColor + stroke so the caller can
// recolour a pin without touching this file.

const BIKE = `
  <circle cx="18.5" cy="17.5" r="3.5"/>
  <circle cx="5.5" cy="17.5" r="3.5"/>
  <circle cx="15" cy="5" r="1"/>
  <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>`;

const CAR = `
  <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/>
  <path d="M7 14h.01"/>
  <path d="M17 14h.01"/>
  <rect width="18" height="8" x="3" y="10" rx="2"/>
  <path d="M5 18v2"/>
  <path d="M19 18v2"/>`;

// Auto rickshaw has no lucide glyph — the taxi front (roof sign + cab) is the
// closest read, and ops recognise it as "the small three-wheeler one".
const AUTO = `
  <path d="M10 2h4"/>
  ${CAR}`;

const XL = `
  <path d="M4 6 2 7"/>
  <path d="M10 6h4"/>
  <path d="m22 7-2-1"/>
  <rect width="16" height="16" x="4" y="3" rx="2"/>
  <path d="M4 11h16"/>
  <path d="M8 15h.01"/>
  <path d="M16 15h.01"/>
  <path d="M6 19v2"/>
  <path d="M18 21v-2"/>`;

const GLYPHS = {
  bike:    BIKE,
  auto:    AUTO,
  car:     CAR,
  xl:      XL,
  premium: CAR,
  luxury:  CAR,
};

// A driver can hold several categories at once. Pick the largest vehicle they
// can serve — that is the one dispatch cares about when scanning the map.
const PRIORITY = ['xl', 'luxury', 'premium', 'car', 'auto', 'bike'];

export const glyphForTypes = (types = []) => {
  const pick = PRIORITY.find(t => types.includes(t));
  return GLYPHS[pick] || CAR;
};

// Trail endpoints — same pin shape so the map reads as one visual language.
export const GLYPH_START = `<polygon points="6 3 20 12 6 21 6 3"/>`;
export const GLYPH_END = `
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
  <line x1="4" x2="4" y1="22" y2="15"/>`;

export const PIN_PATH = 'M17 43C17 43 32 26.5 32 16.5A15 15 0 1 0 2 16.5C2 26.5 17 43 17 43Z';

/**
 * A teardrop pin with a vehicle glyph inside.
 *
 * The pin body is WHITE and the glyph is drawn in the status colour. A coloured
 * body with a white glyph looked fine in isolation but vanished on the map —
 * OSM tiles are pale and busy, so a thin white line inside a small saturated
 * shape reads as noise. White body + coloured outline + coloured glyph keeps
 * the status colour legible and makes the vehicle shape actually recognisable.
 *
 * Returns the geometry alongside the markup so MapView can anchor the pin's
 * tip — not its centre — on the real coordinate, without knowing the shape.
 */
export const pinIcon = ({
  glyph,
  colour = '#062154',
  faded = false,
  selected = false,
  badge = null,          // small text bubble above the pin, e.g. a ride number
  size = 34,
}) => {
  const h = Math.round(size * 1.3);
  const html = `
<div style="position:relative;width:${size}px;height:${h}px;opacity:${faded ? 0.75 : 1};
  filter:drop-shadow(0 2px 3px rgba(11,11,11,.35));">
  ${badge ? `<span style="
      position:absolute;bottom:${h - 2}px;left:50%;transform:translateX(-50%);
      background:#062154;color:#fff;font:700 9px/1.5 Inter,system-ui,sans-serif;
      padding:1px 5px;border-radius:6px;white-space:nowrap;border:1px solid #fff;
    ">${badge}</span>` : ''}
  <svg width="${size}" height="${h}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    ${selected ? `<path d="${PIN_PATH}" fill="none" stroke="#062154" stroke-width="7" stroke-opacity="0.35"/>` : ''}
    <path d="${PIN_PATH}" fill="#ffffff" stroke="${colour}" stroke-width="3"/>
    <g transform="translate(6.2 5.7) scale(0.9)"
       fill="none" stroke="${colour}" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round">
      ${glyph}
    </g>
  </svg>
</div>`;

  return {
    html,
    iconSize:      [size, h],
    iconAnchor:    [size / 2, h],   // tip of the teardrop
    tooltipAnchor: [0, -h],
  };
};
