import { describe, expect, it } from 'vitest';
import { GUIDE_CSV_HEADER, SERIES_CSV_HEADER, buildCsv, csvFileName, escapeCsv, guideFileName, guideToCsv, seriesToCsv } from '../csv';

describe('escapeCsv', () => {
  it('leaves simple values alone', () => {
    expect(escapeCsv('abc')).toBe('abc');
    expect(escapeCsv(12.5)).toBe('12.5');
    expect(escapeCsv(-402)).toBe('-402');
  });
  it('writes null/undefined/NaN as empty cells', () => {
    expect(escapeCsv(null)).toBe('');
    expect(escapeCsv(undefined)).toBe('');
    expect(escapeCsv(Number.NaN)).toBe('');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
  });
  it('defuses spreadsheet formulas but keeps signed numbers as text', () => {
    expect(escapeCsv('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsv('-12')).toBe('-12');
  });
});

describe('seriesToCsv', () => {
  it('writes a header and one row per point, with gaps as empty cells', () => {
    const csv = seriesToCsv([
      { time: '2026-01-02T00:00:00Z', actual: 14202, forecast: 13800, publish_time: '2026-01-01T07:30:00Z', horizon_h: 16.5, error: -402 },
      { time: '2026-01-02T01:00:00Z', actual: null, forecast: null, publish_time: null, horizon_h: null, error: null },
    ]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(SERIES_CSV_HEADER.map(escapeCsv).join(','));
    expect(lines[1]).toBe('2026-01-02,00:00,2026-01-02T00:00:00Z,14202,13800,-402,2026-01-01 07:30,16.5');
    expect(lines[2]).toBe('2026-01-02,01:00,2026-01-02T01:00:00Z,,,,,');
    expect(lines).toHaveLength(3);
  });

  it('handles an empty series', () => {
    expect(buildCsv(['a', 'b'], [])).toBe('a,b\r\n');
  });

  it('names the file after the settings', () => {
    expect(csvFileName({ start: '2026-01-02', end: '2026-02-01', mode: 'deadline', cutoff: '09:00', horizon: 24 })).toBe(
      'windcast_2026-01-02_2026-02-01_cutoff-0900.csv',
    );
    expect(csvFileName({ start: '2026-01-02', end: '2026-01-03', mode: 'horizon', cutoff: '09:00', horizon: 6 })).toBe(
      'windcast_2026-01-02_2026-01-03_horizon-6h.csv',
    );
  });
});

describe('UK time in CSV', () => {
  it('uses UK summer time for delivery day and hour', () => {
    const csv = seriesToCsv([{ time: '2026-06-30T23:00:00Z', actual: 1, forecast: 2, publish_time: '2026-06-29T08:00:00Z', horizon_h: 39, error: 1 }]);
    expect(csv.split('\r\n')[1]).toBe('2026-07-01,00:00,2026-06-30T23:00:00Z,1,2,1,2026-06-29 09:00,39');
  });
});

describe('guideToCsv', () => {
  const guide = {
    date: '2026-01-28', cutoff: '09:00', confidence: 90 as const, margin_mw: 3756.7,
    hours: [
      { time: '2026-01-28T00:00:00Z', forecast: 15208, safe_wind: 11451.3, actual: 12000, publish_time: '2026-01-27T07:30:00Z' },
      { time: '2026-01-28T01:00:00Z', forecast: 15000, safe_wind: 11243.3, actual: 9000, publish_time: '2026-01-27T07:30:00Z' },
      { time: '2026-01-28T02:00:00Z', forecast: null, safe_wind: null, actual: 9000, publish_time: null },
    ],
    totals: { forecast_mwh: 30208, safe_mwh: 22694.6, actual_mwh: 30000 },
  };
  it('writes buffer, safe level and whether the plan was covered', () => {
    const lines = guideToCsv(guide).trimEnd().split('\r\n');
    expect(lines[0]).toBe(GUIDE_CSV_HEADER.join(','));
    expect(lines[1]).toBe('00:00,15208,3756.7,11451.3,12000,Yes,2026-01-27 07:30');
    expect(lines[2]).toBe('01:00,15000,3756.7,11243.3,9000,No,2026-01-27 07:30');
    expect(lines[3]).toBe('02:00,,,,9000,,');
    expect(guideFileName(guide)).toBe('windcast_buying-guide_2026-01-28_cutoff-0900_90pct.csv');
  });
});
