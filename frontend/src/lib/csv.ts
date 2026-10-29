import type { AnalysisParams, BuyingGuide, SeriesPoint } from '../api/types';
import { UK_TZ } from './dates';

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

// Spreadsheet-friendly UK local parts: "2026-01-02" and "09:00".
const ukParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function uk(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const p = Object.fromEntries(ukParts.formatToParts(t).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const ukDateTime = (iso: string | null) => {
  const u = uk(iso);
  return u ? `${u.date} ${u.time}` : null;
};

export const SERIES_CSV_HEADER = [
  'Delivery day (UK)',
  'Hour starting (UK)',
  'Hour starting (UTC)',
  'Actual wind (MW)',
  'Forecast wind (MW)',
  'Error (MW, forecast minus actual)',
  'Forecast published (UK)',
  'Forecast age (hours)',
];

export function seriesToCsv(series: SeriesPoint[]): string {
  return buildCsv(
    SERIES_CSV_HEADER,
    series.map((p) => {
      const u = uk(p.time);
      return [u?.date, u?.time, p.time, p.actual, p.forecast, p.error, ukDateTime(p.publish_time), p.horizon_h];
    }),
  );
}

export const GUIDE_CSV_HEADER = [
  'Hour starting (UK)',
  'Forecast wind (MW)',
  'Safety buffer (MW)',
  'Safe wind to plan on (MW)',
  'Actual wind (MW)',
  'Plan covered',
  'Forecast published (UK)',
];

export function guideToCsv(g: BuyingGuide): string {
  return buildCsv(
    GUIDE_CSV_HEADER,
    g.hours.map((h) => [
      uk(h.time)?.time,
      h.forecast,
      h.forecast !== null && h.safe_wind !== null ? Math.round((h.forecast - h.safe_wind) * 10) / 10 : null,
      h.safe_wind,
      h.actual,
      h.actual === null || h.safe_wind === null ? null : h.actual >= h.safe_wind ? 'Yes' : 'No',
      ukDateTime(h.publish_time),
    ]),
  );
}

export function csvFileName(p: AnalysisParams): string {
  const rule = p.mode === 'deadline' ? `cutoff-${p.cutoff.replace(':', '')}` : `horizon-${p.horizon}h`;
  return `windcast_${p.start}_${p.end}_${rule}.csv`;
}

export function guideFileName(g: BuyingGuide): string {
  return `windcast_buying-guide_${g.date}_cutoff-${g.cutoff.replace(':', '')}_${g.confidence}pct.csv`;
}

/** Browser-only: trigger a download. Kept tiny so the builders above stay pure/testable. */
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
