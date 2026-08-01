import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps a page's filters in the URL query string.
 *
 * The URL becomes the single source of truth, so filters survive a refresh,
 * a shared link, and browser back/forward (e.g. list → detail → back).
 *
 * Only values that differ from the default are written, so an unfiltered
 * list keeps a clean URL. Any query param not listed in `defaults` is left
 * untouched (e.g. `?open=123` on the transactions modal).
 *
 *   const DEFAULTS = { status: '', q: '' };            // module scope, not inline
 *   const [f, setFilter, resetFilters, isFiltered] = useUrlFilters(DEFAULTS);
 *
 *   <Select value={f.status} onChange={(v) => setFilter({ status: v })} />
 *
 * @param   {Object} defaults  filter key → default value (all strings)
 * @returns {[Object, (patch: Object) => void, () => void, boolean]}
 */
export default function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Defaults never change for the life of a page — freeze the first object we
  // get so callers may pass a literal without invalidating every callback.
  const def = useRef(defaults).current;

  const values = useMemo(() => {
    const out = {};
    for (const key of Object.keys(def)) {
      const raw = searchParams.get(key);
      out[key] = raw == null ? def[key] : raw;
    }
    return out;
  }, [searchParams, def]);

  const setFilter = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, val] of Object.entries(patch)) {
        const v = val == null ? '' : String(val);
        // Drop the param only when it matches the default — an empty value can
        // itself be a real choice ("All") when the default is non-empty.
        if (v === String(def[key] ?? '')) next.delete(key);
        else next.set(key, v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, def]);

  const resetFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.keys(def).forEach(key => next.delete(key));
      return next;
    }, { replace: true });
  }, [setSearchParams, def]);

  const isFiltered = useMemo(
    () => Object.keys(def).some(key => values[key] !== def[key]),
    [values, def],
  );

  return [values, setFilter, resetFilters, isFiltered];
}
