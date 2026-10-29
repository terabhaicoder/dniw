import type { Analysis, AnalysisParams, BuyingGuide, Confidence, HorizonPoint, Meta } from './types';

export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type Query = Record<string, string | number | undefined>;

export function buildUrl(path: string, query: Query = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ''}`;
}

/** Turn FastAPI's 422 `detail` (string or list of {msg}) into one readable line. */
export function describeDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m);
    return msgs.length ? msgs.join('; ') : null;
  }
  return null;
}

async function getJson<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  if (import.meta.env.VITE_MOCK === '1') {
    const { mockFetch } = await import('./mock');
    await new Promise((r) => setTimeout(r, 250)); // let loading states be seen
    return mockFetch(path, query ?? {}) as T;
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail;
    } catch {
      /* body not JSON */
    }
    const msg =
      res.status === 422
        ? `Some settings were not accepted: ${describeDetail(detail) ?? 'invalid input'}`
        : `Server error (${res.status}). Please try again.`;
    throw new ApiError(res.status, msg, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  meta: (signal?: AbortSignal) => getJson<Meta>('/api/meta', undefined, signal),
  analysis: (p: AnalysisParams, signal?: AbortSignal) =>
    getJson<Analysis>(
      '/api/analysis',
      {
        start: p.start,
        end: p.end,
        mode: p.mode,
        // Only send the parameter that matters for the chosen mode (keeps cache keys honest).
        cutoff: p.mode === 'deadline' ? p.cutoff : undefined,
        horizon: p.mode === 'horizon' ? p.horizon : undefined,
      },
      signal,
    ),
  horizonCurve: (start: string, end: string, signal?: AbortSignal) =>
    getJson<HorizonPoint[]>('/api/horizon-curve', { start, end }, signal),
  buyingGuide: (date: string, cutoff: string, confidence: Confidence, signal?: AbortSignal) =>
    getJson<BuyingGuide>('/api/buying-guide', { date, cutoff, confidence }, signal),
};
