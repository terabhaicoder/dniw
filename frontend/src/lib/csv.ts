import type { AnalysisParams, SeriesPoint } from '../api/types';

export type CsvValue = string | number | null | undefined;

/** RFC 4180 escaping: quote fields containing comma, quote, CR or LF; double inner quotes.
 *  Also neutralises spreadsheet formula injection for text starting with = + - @. */
export function escapeCsv(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (/^[=+\-@]/.test(s) && !/^[+-]?\d/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n') + '\r\n';
}

export const SERIES_CSV_HEADER = [
  'time_utc',
  'actual_mw',
  'forecast_mw',
  'error_mw',
  'forecast_published_utc',
  'horizon_h',
];

export function seriesToCsv(series: SeriesPoint[]): string {
  return buildCsv(
    SERIES_CSV_HEADER,
    series.map((p) => [p.time, p.actual, p.forecast, p.error, p.publish_time, p.horizon_h]),
  );
}

export function csvFileName(p: AnalysisParams): string {
  const rule = p.mode === 'deadline' ? `cutoff-${p.cutoff.replace(':', '')}` : `horizon-${p.horizon}h`;
  return `windcast_${p.start}_${p.end}_${rule}.csv`;
}

/** Browser-only: trigger a download. Kept tiny so the builder above stays pure/testable. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
