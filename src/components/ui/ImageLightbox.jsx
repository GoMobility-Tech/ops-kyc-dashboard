import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, ExternalLink, ImageOff } from 'lucide-react';

const STEPS = [1, 1.5, 2, 3, 4];

/**
 * Full-screen zoomable image viewer.
 *
 * Props:
 *   images  — [{ url, label }]
 *   index   — index into images, or null/-1 when closed
 *   onIndex — (i) => void  (prev / next)
 *   onClose — () => void
 *
 * Keyboard: Esc close · ← → navigate · + − zoom · 0 reset
 */
export default function ImageLightbox({ images = [], index, onIndex, onClose }) {
  const [zoom, setZoom] = useState(0);
  const [failed, setFailed] = useState(false);

  const open  = index != null && index >= 0 && index < images.length;
  const image = open ? images[index] : null;

  // Reset zoom + error state whenever a different image is shown
  useEffect(() => { setZoom(0); setFailed(false); }, [index]);

  const go = useCallback((delta) => {
    if (!images.length) return;
    onIndex?.((index + delta + images.length) % images.length);
  }, [images.length, index, onIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose?.();
      if (e.key === 'ArrowLeft')  go(-1);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 1, STEPS.length - 1));
      if (e.key === '-' || e.key === '_') setZoom(z => Math.max(z - 1, 0));
      if (e.key === '0') setZoom(0);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, go]);

  if (!open) return null;

  const scale = STEPS[zoom];
  const many  = images.length > 1;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex flex-col"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between gap-3 px-4 py-3 bg-accent-navy/90 text-white shrink-0"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{image.label}</p>
          {many && (
            <p className="text-[11px] text-brand-400">{index + 1} of {images.length}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setZoom(z => Math.max(z - 1, 0))}
            disabled={zoom === 0}
            title="Zoom out (−)"
            className="p-2 rounded-lg text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(0)}
            title="Reset zoom (0)"
            className="px-2 py-1 rounded-lg text-[11px] font-semibold tabular-nums text-white/80 hover:bg-white/15 hover:text-white transition min-w-[46px]"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => setZoom(z => Math.min(z + 1, STEPS.length - 1))}
            disabled={zoom === STEPS.length - 1}
            title="Zoom in (+)"
            className="p-2 rounded-lg text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ZoomIn size={16} />
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original in a new tab"
            className="p-2 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto flex items-center justify-center p-4">
        {many && (
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            title="Previous (←)"
            className="fixed left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-accent-navy/80 text-white hover:bg-accent-navy transition"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {failed ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="text-center text-white/70 space-y-2"
          >
            <ImageOff size={28} className="mx-auto" />
            <p className="text-xs">Preview unavailable — the S3 link may have expired.</p>
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-500 underline"
            >
              <ExternalLink size={12} /> Open original
            </a>
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.label}
            onClick={(e) => e.stopPropagation()}
            onError={() => setFailed(true)}
            style={{ transform: `scale(${scale})` }}
            className="max-w-full max-h-full object-contain origin-center transition-transform duration-150 rounded-lg shadow-pop"
          />
        )}

        {many && (
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            title="Next (→)"
            className="fixed right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-accent-navy/80 text-white hover:bg-accent-navy transition"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
