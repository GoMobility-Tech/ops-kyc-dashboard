// Client-side image compression to dodge 413 / API-gateway payload caps.
// - Skips non-images (PDFs etc.) and files already under TARGET_BYTES.
// - Resizes to max MAX_EDGE on the longest edge.
// - Re-encodes JPEG with progressively lower quality until under TARGET_BYTES (or floor reached).

const MAX_EDGE     = 1600;
const TARGET_BYTES = 500 * 1024;          // ~500 KB — gateway caps payload ~1 MB, leave headroom
const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3];

const readImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
  img.src = url;
});

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

async function encodeAtEdge(img, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width  * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  for (const q of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', q);
    if (!blob) continue;
    if (blob.size <= TARGET_BYTES) return blob;
  }
  // last quality fallback
  return canvasToBlob(canvas, 'image/jpeg', QUALITY_STEPS[QUALITY_STEPS.length - 1]);
}

export async function compressImage(file) {
  if (!file) return file;
  if (!file.type || !file.type.startsWith('image/')) return file;
  // Always re-encode images — even a 1MB JPEG just over the gateway limit needs to shrink.
  // EXIF stripping + re-encode reliably brings phone photos under 500KB.

  try {
    const img = await readImage(file);
    // Pass 1 — normal max edge
    let blob = await encodeAtEdge(img, MAX_EDGE);
    // Pass 2 — if still too big, drop to 1200px
    if (blob && blob.size > TARGET_BYTES) blob = await encodeAtEdge(img, 1200);
    // Pass 3 — last resort 900px
    if (blob && blob.size > TARGET_BYTES) blob = await encodeAtEdge(img, 900);
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
