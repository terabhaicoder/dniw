import type { Confidence, Meta, Mode } from '../api/types';
import { clampDate, isIsoDate } from './dates';

/** Everything the dashboard needs to reproduce a view. Lives in the URL query string. */
export interface DashboardState {
  start: string;
  end: string;
  mode: Mode;
  cutoff: string;
  horizon: number;
  /** Delivery day for the buying guide ('' = use the last day in range). */
  day: string;
  confidence: Confidence;
}

export const DEFAULT_BOUNDS = { min: '2026-01-02', max: '2026-02-01' } as const;
export const MAX_HORIZON = 48;
export const CONFIDENCES: readonly Confidence[] = [50, 80, 90, 95];

export const DEFAULT_STATE: DashboardState = {
  start: DEFAULT_BOUNDS.min,
  end: DEFAULT_BOUNDS.max,
  mode: 'deadline',
  cutoff: '09:00',
  horizon: 24,
  day: '',
  confidence: 90,
};

/** Cutoff choices: 06:00 → 12:00 every 30 minutes. */
export const CUTOFF_OPTIONS: string[] = Array.from({ length: 13 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${mins % 60 === 0 ? '00' : '30'}`;
});

export interface Bounds {
  min: string;
  max: string;
  maxHorizon: number;
}

export function boundsFromMeta(meta: Meta | undefined): Bounds {
  return meta
    ? { min: meta.delivery_start, max: meta.delivery_end, maxHorizon: meta.max_horizon }
    : { ...DEFAULT_BOUNDS, maxHorizon: MAX_HORIZON };
}

function parseIntStrict(s: string | null): number | null {
  if (s === null || !/^\d{1,3}$/.test(s)) return null;
  return Number(s);
}

/**
 * Parse a query string into a valid state. Every field is validated on its own:
 * a bad value falls back to its default without throwing away the good ones.
 */
export function parseState(search: string, bounds: Bounds = boundsFromMeta(undefined)): DashboardState {
  const q = new URLSearchParams(search);
  const d = DEFAULT_STATE;

  const dateOr = (key: string, fallback: string) => {
    const v = q.get(key);
    return v && isIsoDate(v) ? clampDate(v, bounds.min, bounds.max) : fallback;
  };
  let start = dateOr('start', bounds.min);
  let end = dateOr('end', bounds.max);
  if (start > end) [start, end] = [end, start];

  const modeRaw = q.get('mode');
  const mode: Mode = modeRaw === 'horizon' || modeRaw === 'deadline' ? modeRaw : d.mode;

  const cutoffRaw = q.get('cutoff');
  const cutoff = cutoffRaw && CUTOFF_OPTIONS.includes(cutoffRaw) ? cutoffRaw : d.cutoff;

  const h = parseIntStrict(q.get('horizon'));
  const horizon = h !== null && h <= bounds.maxHorizon ? h : Math.min(d.horizon, bounds.maxHorizon);

  const dayRaw = q.get('day');
  const day = dayRaw && isIsoDate(dayRaw) && dayRaw >= start && dayRaw <= end ? dayRaw : '';

  const c = parseIntStrict(q.get('conf'));
  const confidence = (CONFIDENCES as readonly number[]).includes(c ?? -1) ? (c as Confidence) : d.confidence;

  return { start, end, mode, cutoff, horizon, day, confidence };
}

/** Serialise, leaving out values equal to their defaults so links stay short. */
export function serializeState(s: DashboardState, bounds: Bounds = boundsFromMeta(undefined)): string {
  const q = new URLSearchParams();
  if (s.start !== bounds.min) q.set('start', s.start);
  if (s.end !== bounds.max) q.set('end', s.end);
  if (s.mode !== DEFAULT_STATE.mode) q.set('mode', s.mode);
  if (s.cutoff !== DEFAULT_STATE.cutoff) q.set('cutoff', s.cutoff);
  if (s.horizon !== DEFAULT_STATE.horizon) q.set('horizon', String(s.horizon));
  if (s.day) q.set('day', s.day);
  if (s.confidence !== DEFAULT_STATE.confidence) q.set('conf', String(s.confidence));
  // ':' is legal in a query string; keep it readable (cutoff=09:30 rather than 09%3A30).
  const str = q.toString().replace(/%3A/gi, ':');
  return str ? `?${str}` : '';
}

/** Delivery day used by the buying guide. */
export function effectiveDay(s: DashboardState): string {
  return s.day || s.end;
}
