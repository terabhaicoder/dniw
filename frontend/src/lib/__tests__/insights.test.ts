import { describe, expect, it } from 'vitest';
import { mockBuyingGuide } from '../../api/mock';
import { buildCards, buyingSentence, describePercentiles, hindsight } from '../insights';
import { medianHorizon, toHistogramRows, toSeriesRows } from '../chartData';

describe('describePercentiles', () => {
  it('reads P90 as the "too high" bound', () => {
    const [first, second, third] = describePercentiles({ p10: -1900, p50: 50, p90: 2100 });
    expect(first).toBe('9 in 10 hours, the forecast was no more than 2.10 GW too high.');
    expect(second).toBe('9 in 10 hours, it was no more than 1.90 GW too low.');
    expect(third).toBe('The middle (typical) error was +0.05 GW.');
  });
  it('handles all-null percentiles', () => {
    expect(describePercentiles({ p10: null, p50: null, p90: null })).toEqual([]);
  });
});

describe('buildCards', () => {
  it('shows dashes when there is no data', () => {
    const cards = buildCards({
      count: 0, mae: null, rmse: null, bias: null, nmae_pct: null, mean_actual: null,
      p10: null, p50: null, p90: null, max_over: null, max_under: null, coverage_pct: null,
    });
    expect(cards.map((c) => c.value)).toEqual(['—', '—', '—', '—', '—']);
  });
});

describe('buying guide text', () => {
  it('builds the plan sentence and a hindsight check', () => {
    const g = mockBuyingGuide('2026-01-15', '09:00', 90);
    expect(buyingSentence(g)).toMatch(/^Plan on at least [\d,.]+ GWh of wind; buy the rest from the market\.$/);
    expect(hindsight(g)).toMatch(/^In hindsight, [\d,.]+ GWh of wind actually came\./);
  });
  it('returns null when totals are missing', () => {
    const g = { ...mockBuyingGuide('2026-01-15', '09:00', 90), totals: { forecast_mwh: null, safe_mwh: null, actual_mwh: null } };
    expect(buyingSentence(g)).toBeNull();
    expect(hindsight(g)).toBeNull();
  });
});

describe('chart data', () => {
  it('keeps nulls as nulls so lines show gaps (not zero)', () => {
    const rows = toSeriesRows([{ time: '2026-01-02T00:00:00Z', actual: null, forecast: 1000, publish_time: null, horizon_h: null, error: null }]);
    expect(rows[0]).toMatchObject({ actual: null, forecast: 1, error: null });
  });
  it('builds a closed step histogram in GW', () => {
    expect(toHistogramRows([{ bin_start: 500, bin_end: 1000, count: 2 }, { bin_start: 0, bin_end: 500, count: 5 }])).toEqual([
      { x: 0, count: 5 },
      { x: 0.5, count: 2 },
      { x: 1, count: 2 },
    ]);
    expect(toHistogramRows([])).toEqual([]);
  });
  it('finds the median horizon ignoring nulls', () => {
    const p = (h: number | null) => ({ time: '', actual: null, forecast: null, publish_time: null, horizon_h: h, error: null });
    expect(medianHorizon([p(10), p(null), p(20), p(30)])).toBe(20);
    expect(medianHorizon([p(10), p(20)])).toBe(15);
    expect(medianHorizon([p(null)])).toBeNull();
  });
});
