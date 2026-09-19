// ─── Exports screen ke chhote helpers ───────────────────────────────────────

export const STATUS_TONE = {
  queued:  'neutral',
  running: 'info',
  ready:   'success',
  failed:  'danger',
};

export const STATUS_LABEL = {
  queued:  'Queued',
  running: 'Building…',
  ready:   'Ready',
  failed:  'Failed',
};

export const fmtWhen = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

export const fmtBytes = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
};

export const fmtCount = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-IN') : '—';
};

/**
 * Khaali filters hata deta hai — backend ko sirf wahi bhejna hai jo user ne
 * sach me bhara. Khaali object bhejne se woh "filter laga hai" jaisa dikhta
 * hai aur summary me bhi aa jaata hai.
 */
export const cleanFilters = (draft) => {
  const out = {};
  for (const [key, value] of Object.entries(draft || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) out[key] = value;
      continue;
    }
    if (typeof value === 'object') {
      const kept = Object.fromEntries(
        Object.entries(value).filter(([, v]) =>
          v !== undefined && v !== null && v !== '' &&
          !(Array.isArray(v) && v.length === 0)),
      );
      if (Object.keys(kept).length) out[key] = kept;
      continue;
    }
    out[key] = value;
  }
  return out;
};

/** Kitne filter sach me lage hain — badge me dikhta hai. */
export const countFilters = (draft) => Object.keys(cleanFilters(draft)).length;

// Browser ko file par bhejne ka tareeka.
//
// `window.open` popup blocker ke chakkar me phans jaata hai kyunki click aur
// link milne ke beech ek await hota hai. Anchor banake click karna har jagah
// chalta hai.
export const triggerDownload = (url) => {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};
