import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Thin Leaflet wrapper — the only place in the app that touches Leaflet directly.
 *
 * A marker renders one of two ways, decided by the caller:
 *   • `html` present → a DOM pin (L.divIcon), so it can carry a vehicle glyph
 *     and a badge. Richer, but one DOM node each — don't ship thousands.
 *   • otherwise      → a `circleMarker`, cheap enough for dense point clouds.
 *
 * Colour and opacity always come from the caller, so map semantics (status,
 * staleness) stay with the data instead of being reinvented here.
 *
 *   markers  [{ id, lat, lng, colour, faded, selected, tooltip,
 *               html?, iconSize?, iconAnchor?, tooltipAnchor? }]
 *   segments [{ points: [[lat,lng]…], colour, dashed }]  — location trail
 */
export default function MapView({
  markers = [],
  segments = [],
  center = [30.9012, 75.8573],   // Ludhiana — the fleet's home city
  zoom = 12,
  onBoundsChange,
  onMarkerClick,
  fitKey = null,                 // change it to re-fit the viewport to the data
  className = '',
  style,
}) {
  const hostRef    = useRef(null);
  const mapRef     = useRef(null);
  const markerLyr  = useRef(null);
  const lineLyr    = useRef(null);

  // Handlers live in refs so re-renders never force a map teardown.
  const boundsCb = useRef(onBoundsChange);
  const clickCb  = useRef(onMarkerClick);
  boundsCb.current = onBoundsChange;
  clickCb.current  = onMarkerClick;

  useEffect(() => {
    if (mapRef.current || !hostRef.current) return;

    const map = L.map(hostRef.current, { center, zoom, zoomControl: true, preferCanvas: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    markerLyr.current = L.layerGroup().addTo(map);
    lineLyr.current   = L.layerGroup().addTo(map);

    const emit = () => {
      const b = map.getBounds();
      boundsCb.current?.({
        swLat: +b.getSouth().toFixed(6), swLng: +b.getWest().toFixed(6),
        neLat: +b.getNorth().toFixed(6), neLng: +b.getEast().toFixed(6),
      });
    };
    map.on('moveend', emit);
    mapRef.current = map;

    // Leaflet measures the container on init; if we mounted inside a tab that
    // was still laying out, the tiles come back sized wrong without this.
    const t = setTimeout(() => { map.invalidateSize(); emit(); }, 0);

    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── markers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = markerLyr.current;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach(m => {
      if (m.lat == null || m.lng == null) return;

      const mk = m.html
        ? L.marker([m.lat, m.lng], {
          // A selected pin must not hide behind its neighbours.
          zIndexOffset: m.selected ? 1000 : 0,
          icon: L.divIcon({
            html: m.html,
            className: '',            // strip Leaflet's default white box
            iconSize:      m.iconSize      || [34, 44],
            iconAnchor:    m.iconAnchor    || [17, 44],
            tooltipAnchor: m.tooltipAnchor || [0, -44],
          }),
        })
        : L.circleMarker([m.lat, m.lng], {
          radius: m.selected ? 10 : 7,
          color: m.selected ? '#062154' : '#ffffff',
          weight: m.selected ? 3 : 2,
          fillColor: m.colour,
          fillOpacity: m.faded ? 0.45 : 0.95,
          opacity: m.faded ? 0.5 : 1,
        });

      if (m.tooltip) {
        mk.bindTooltip(m.tooltip, {
          direction: 'top',
          ...(m.html ? {} : { offset: [0, -8] }),
        });
      }
      if (clickCb.current) mk.on('click', () => clickCb.current(m));
      mk.addTo(layer);
    });
  }, [markers]);

  // ── trail segments ─────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = lineLyr.current;
    if (!layer) return;
    layer.clearLayers();

    segments.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      L.polyline(s.points, {
        color: s.colour,
        weight: s.dashed ? 2 : 3,
        opacity: s.dashed ? 0.6 : 0.9,
        dashArray: s.dashed ? '6 6' : undefined,
      }).addTo(layer);
    });
  }, [segments]);

  // ── fit viewport on demand ─────────────────────────────────────────────────
  useEffect(() => {
    if (fitKey == null || !mapRef.current) return;
    const pts = [
      ...markers.filter(m => m.lat != null && m.lng != null).map(m => [m.lat, m.lng]),
      ...segments.flatMap(s => s.points || []),
    ];
    if (!pts.length) return;
    mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={hostRef} className={`rounded-xl border border-line z-0 ${className}`} style={{ minHeight: 320, ...style }} />;
}
