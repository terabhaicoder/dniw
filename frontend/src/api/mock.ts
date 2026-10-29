/**
 * Deterministic mock data that follows docs/API.md. Used by tests, and in dev with VITE_MOCK=1
 * when the backend is not running. Not bundled in production unless VITE_MOCK=1 at build time.
 */
import { dateRange } from '../lib/dates';
import type { Analysis, AnalysisParams, BuyingGuide, Confidence, HorizonPoint, Meta, SeriesPoint } from './types';

export const mockMeta: Meta = {
  delivery_start: '2026-01-02',
  delivery_end: '2026-02-01',
  default_cutoff: '09:00',
  max_horizon: 48,
  forecast_versions: 272,
  actual_points: 1584,
  source: 'mock',
  data_note: 'Mock data (backend not running)',
};

/** Small seeded PRNG so every run gives the same numbers. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo));
}

function hourlyTimes(start: string, end: string): string[] {
  // UK winter = UTC, so delivery day hours are 00:00Z..23:00Z for this dataset.
  return dateRange(start, end).flatMap((d) =>
    Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00:00Z`),
  );
}

export function mockAnalysis(p: AnalysisParams): Analysis {
  const r = rng(p.start.length * 31 + (p.mode === 'horizon' ? p.horizon : Number(p.cutoff.replace(':', ''))));
  const scale = p.mode === 'horizon' ? 300 + p.horizon * 45 : 1500;
  const series: SeriesPoint[] = hourlyTimes(p.start, p.end).map((time, i) => {
    const t = Date.parse(time);
    const actual = i % 97 === 50 ? null : round(11000 + 6000 * Math.sin(i / 30) + 1500 * Math.sin(i / 5) + r() * 800);
    const forecastBase = actual ?? 11000;
    const forecast = i % 131 === 7 ? null : round(Math.max(0, forecastBase + (r() - 0.45) * 2 * scale));
    const publish = forecast === null ? null : new Date(t - (p.mode === 'horizon' ? p.horizon + 0.5 : 16 + (i % 24)) * 3_600_000).toISOString().replace('.000', '');
    return {
      time,
      actual,
      forecast,
      publish_time: publish,
      horizon_h: publish ? (t - Date.parse(publish)) / 3_600_000 : null,
      error: actual !== null && forecast !== null ? round(forecast - actual) : null,
    };
  });
  const errs = series.map((s) => s.error).filter((e): e is number => e !== null);
  const sorted = [...errs].sort((a, b) => a - b);
  const n = errs.length;
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const actuals = series.map((s) => s.actual).filter((a): a is number => a !== null);
  const mae = mean(errs.map(Math.abs));
  const meanActual = mean(actuals);

  const histogram = [];
  for (let b = -4000; b < 4000; b += 500) {
    histogram.push({ bin_start: b, bin_end: b + 500, count: errs.filter((e) => e >= b && e < b + 500).length });
  }
  const by_hour = Array.from({ length: 24 }, (_, hour) => {
    const e = series.filter((s) => new Date(s.time).getUTCHours() === hour && s.error !== null).map((s) => s.error as number);
    return { hour, mae: e.length ? round(mean(e.map(Math.abs))!) : null, bias: e.length ? round(mean(e)!) : null, count: e.length };
  });
  const daily = dateRange(p.start, p.end).map((date) => {
    const rows = series.filter((s) => s.time.startsWith(date));
    const e = rows.filter((s) => s.error !== null).map((s) => s.error as number);
    const a = rows.filter((s) => s.actual !== null).map((s) => s.actual as number);
    const f = rows.filter((s) => s.forecast !== null).map((s) => s.forecast as number);
    return {
      date,
      mae: e.length ? round(mean(e.map(Math.abs))!) : null,
      bias: e.length ? round(mean(e)!) : null,
      actual_mean: a.length ? round(mean(a)!) : null,
      forecast_mean: f.length ? round(mean(f)!) : null,
      count: e.length,
    };
  });

  return {
    params: p,
    series,
    metrics: {
      count: n,
      mae: mae === null ? null : round(mae),
      rmse: n ? round(Math.sqrt(mean(errs.map((e) => e * e))!)) : null,
      bias: n ? round(mean(errs)!) : null,
      nmae_pct: mae !== null && meanActual ? round((mae / meanActual) * 100) : null,
      mean_actual: meanActual === null ? null : round(meanActual),
      p10: pct(sorted, 0.1),
      p50: pct(sorted, 0.5),
      p90: pct(sorted, 0.9),
      max_over: n ? sorted[n - 1]! : null,
      max_under: n ? sorted[0]! : null,
      coverage_pct: series.length ? round((series.filter((s) => s.forecast !== null).length / series.length) * 100) : null,
    },
    histogram,
    by_hour,
    daily,
  };
}

export function mockHorizonCurve(): HorizonPoint[] {
  return [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 30, 36, 42, 48].map((h) => ({
    horizon_h: h,
    mae: round(350 + h * 32),
    rmse: round(480 + h * 41),
    bias: round(10 + h * 3),
    count: 740,
  }));
}

export function mockBuyingGuide(date: string, cutoff: string, confidence: Confidence): BuyingGuide {
  const margin = { 50: 100, 80: 1200, 90: 2100, 95: 2800 }[confidence];
  const r = rng(Number(date.replace(/-/g, '')));
  const hours = Array.from({ length: 24 }, (_, h) => {
    const forecast = round(12000 + 4000 * Math.sin(h / 4) + r() * 500);
    return {
      time: `${date}T${String(h).padStart(2, '0')}:00:00Z`,
      forecast,
      safe_wind: Math.max(0, forecast - margin),
      actual: round(forecast + (r() - 0.55) * 3000),
      publish_time: `${date}T07:30:00Z`,
    };
  });
  const sum = (k: 'forecast' | 'safe_wind' | 'actual') => hours.reduce((s, x) => s + (x[k] ?? 0), 0);
  return {
    date,
    cutoff,
    confidence,
    margin_mw: margin,
    hours,
    totals: { forecast_mwh: round(sum('forecast')), safe_mwh: round(sum('safe_wind')), actual_mwh: round(sum('actual')) },
  };
}

/** Route a request path to mock data (dev only). */
export function mockFetch(path: string, q: Record<string, string | number | undefined>): unknown {
  const start = String(q.start ?? mockMeta.delivery_start);
  const end = String(q.end ?? mockMeta.delivery_end);
  switch (path) {
    case '/api/health':
      return { status: 'ok' };
    case '/api/meta':
      return mockMeta;
    case '/api/analysis':
      return mockAnalysis({
        start,
        end,
        mode: q.mode === 'horizon' ? 'horizon' : 'deadline',
        cutoff: String(q.cutoff ?? '09:00'),
        horizon: Number(q.horizon ?? 24),
      });
    case '/api/horizon-curve':
      return mockHorizonCurve();
    case '/api/buying-guide':
      return mockBuyingGuide(String(q.date), String(q.cutoff ?? '09:00'), Number(q.confidence ?? 90) as Confidence);
    default:
      throw new Error(`No mock for ${path}`);
  }
}
