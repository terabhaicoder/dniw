import { describe, expect, it } from 'vitest';
import { SERIES_CSV_HEADER, buildCsv, csvFileName, escapeCsv, seriesToCsv } from '../csv';

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
    expect(lines[0]).toBe(SERIES_CSV_HEADER.join(','));
    expect(lines[1]).toBe('2026-01-02T00:00:00Z,14202,13800,-402,2026-01-01T07:30:00Z,16.5');
    expect(lines[2]).toBe('2026-01-02T01:00:00Z,,,,,');
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
