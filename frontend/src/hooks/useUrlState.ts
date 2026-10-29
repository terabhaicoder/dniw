import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { type Bounds, type DashboardState, parseState, serializeState } from '../lib/urlState';

const URL_EVENT = 'windcast:urlchange';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener(URL_EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(URL_EVENT, cb);
  };
}
const getSearch = () => window.location.search;
const getServerSearch = () => '';

export interface SetStateOptions {
  /** Replace the current history entry instead of adding one (for rapid, continuous edits). */
  replace?: boolean;
}

/**
 * Dashboard state stored in the URL query string.
 * - Reads are validated (bad values fall back to defaults).
 * - Writes push a history entry, so Back/Forward walk through views.
 * - The URL is the single source of truth; nothing is duplicated in React state.
 */
export function useUrlState(bounds: Bounds) {
  const { min, max, maxHorizon } = bounds;
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const b = useMemo(() => ({ min, max, maxHorizon }), [min, max, maxHorizon]);
  const state = useMemo(() => parseState(search, b), [search, b]);

  const write = useCallback((qs: string, replace: boolean) => {
    if (qs === window.location.search) return;
    const url = `${window.location.pathname}${qs}${window.location.hash}`;
    if (replace) window.history.replaceState(window.history.state, '', url);
    else window.history.pushState(window.history.state, '', url);
    window.dispatchEvent(new Event(URL_EVENT));
  }, []);

  const setState = useCallback(
    (patch: Partial<DashboardState>, opts: SetStateOptions = {}) => {
      const current = parseState(window.location.search, b);
      const next = parseState(serializeState({ ...current, ...patch }, b), b);
      write(serializeState(next, b), !!opts.replace);
    },
    [b, write],
  );

  // Tidy the address bar: if the URL had invalid/out-of-range values, rewrite it in canonical form.
  useEffect(() => {
    write(serializeState(state, b), true);
  }, [state, b, write]);

  return [state, setState] as const;
}
