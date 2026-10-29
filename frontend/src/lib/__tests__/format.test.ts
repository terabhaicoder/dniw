import { describe, expect, it } from 'vitest';
import { describeBias, formatGW, formatGWh, formatHours, formatPct, formatSignedGW, toGW } from '../format';
import { addDays, dateRange, formatUkDateTime, isIsoDate } from '../dates';

describe('power formatting', () => {
  it('converts MW to GW with fixed decimals', () => {
    expect(formatGW(1234.5)).toBe('1.23 GW');
    expect(formatGW(0)).toBe('0.00 GW');
    expect(formatGW(14202, 1)).toBe('14.2 GW');
  });

  it('shows a dash for missing values', () => {
    expect(formatGW(null)).toBe('n/a');
    expect(formatGW(undefined)).toBe('n/a');
    expect(formatGW(Number.NaN)).toBe('n/a');
    expect(formatPct(null)).toBe('n/a');
    expect(formatGWh(null)).toBe('n/a');
    expect(formatHours(null)).toBe('n/a');
    expect(toGW(null)).toBeNull();
  });

  it('signs values with a real minus sign and no "-0"', () => {
    expect(formatSignedGW(120.3)).toBe('+0.12 GW');
    expect(formatSignedGW(-402)).toBe('−0.40 GW');
    expect(formatSignedGW(-1)).toBe('0.00 GW');
  });

  it('formats energy, percent and hours', () => {
    expect(formatGWh(309600)).toBe('309.6 GWh');
    expect(formatGWh(1234567)).toBe('1,234.6 GWh');
    expect(formatPct(9.84)).toBe('9.8%');
    expect(formatHours(24)).toBe('24 h');
    expect(formatHours(16.5)).toBe('16.5 h');
  });

  it('describes bias in plain words', () => {
    expect(describeBias(120.3)).toBe('Forecasts run 0.12 GW high on average');
    expect(describeBias(-800)).toBe('Forecasts run 0.80 GW low on average');
    expect(describeBias(10)).toBe('Forecasts are about right on average');
    expect(describeBias(null)).toBe('Not enough data');
  });
});

describe('date helpers', () => {
  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-01-31')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-3')).toBe(false);
  });

  it('adds days across month ends and builds inclusive ranges', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(dateRange('2026-01-30', '2026-02-01')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01']);
    expect(dateRange('2026-02-01', '2026-01-30')).toEqual([]);
  });

  it('shows timestamps in UK time (BST aware)', () => {
    expect(formatUkDateTime('2026-01-02T09:00:00Z')).toBe('2 Jan, 09:00');
    expect(formatUkDateTime('2026-07-02T09:00:00Z')).toBe('2 Jul, 10:00');
    expect(formatUkDateTime(null)).toBe('n/a');
  });
});
