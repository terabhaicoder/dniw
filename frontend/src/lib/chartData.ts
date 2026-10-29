import type { DailyStat, HistogramBin, HourStat, HorizonPoint, SeriesPoint } from '../api/types';
import { toGW } from './format';

export interface SeriesRow {
  t: number;
  actual: number | null;
  forecast: number | null;
  error: number | null;
  publish: string | null;
  horizon: number | null;
}

/** Convert API series (MW, ISO) to chart rows (GW, epoch ms). Nulls stay null so lines show gaps. */
export function toSeriesRows(series: SeriesPoint[]): SeriesRow[] {
  return series.map((p) => ({
    t: Date.parse(p.time),
    actual: toGW(p.actual),
    forecast: toGW(p.forecast),
    error: toGW(p.error),
    publish: p.publish_time,
    horizon: p.horizon_h,
  }));
}

export interface HistRow {
  x: number;
  count: number;
}

/** Step-chart points (GW): each bin start with its count, plus a closing point at the last bin end. */
export function toHistogramRows(bins: HistogramBin[]): HistRow[] {
  if (!bins.length) return [];
  const sorted = [...bins].sort((a, b) => a.bin_start - b.bin_start);
  const rows = sorted.map((b) => ({ x: b.bin_start / 1000, count: b.count }));
  const last = sorted[sorted.length - 1]!;
  rows.push({ x: last.bin_end / 1000, count: last.count });
  return rows;
}

export function toHourRows(rows: HourStat[]) {
  return [...rows]
    .sort((a, b) => a.hour - b.hour)
    .map((r) => ({ hour: r.hour, label: `${String(r.hour).padStart(2, '0')}:00`, mae: toGW(r.mae), bias: toGW(r.bias), count: r.count }));
}

export function toHorizonRows(rows: HorizonPoint[]) {
  return [...rows]
    .sort((a, b) => a.horizon_h - b.horizon_h)
    .map((r) => ({ h: r.horizon_h, mae: toGW(r.mae), rmse: toGW(r.rmse), bias: toGW(r.bias), count: r.count }));
}

/** Median of non-null horizons — "how far ahead your deadline typically is". */
export function medianHorizon(series: SeriesPoint[]): number | null {
  const hs = series.map((p) => p.horizon_h).filter((h): h is number => typeof h === 'number').sort((a, b) => a - b);
  if (!hs.length) return null;
  const mid = Math.floor(hs.length / 2);
  return hs.length % 2 ? hs[mid]! : (hs[mid - 1]! + hs[mid]!) / 2;
}

/** Largest absolute value across daily MAE/bias, for scaling inline bars. */
export function dailyScale(rows: DailyStat[]): number {
  let m = 0;
  for (const r of rows) m = Math.max(m, Math.abs(r.mae ?? 0), Math.abs(r.bias ?? 0));
  return m || 1;
}

/** Recharts tooltip formatter for GW values (null → "no data"). */
export function gwFormatter(v: unknown, name: unknown): [string, string] {
  return [typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)} GW` : 'no data', String(name)];
}
