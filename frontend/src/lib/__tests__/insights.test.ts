import { describe, expect, it } from 'vitest';
import { mockBuyingGuide } from '../../api/mock';
import { buildCards, buildTakeaways, describePercentiles, guideCheck } from '../insights';
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
    expect(cards.map((c) => c.value)).toEqual(['n/a', 'n/a', 'n/a', 'n/a', 'n/a']);
  });
});

describe('guideCheck', () => {
  it('counts hours where real wind fell below the plan', () => {
    const g = mockBuyingGuide('2026-01-15', '09:00', 90);
    const c = guideCheck(g)!;
    const scored = g.hours.filter((h) => h.actual !== null && h.safe_wind !== null);
    expect(c.scored).toBe(scored.length);
    expect(c.short).toBe(scored.filter((h) => h.actual! < h.safe_wind!).length);
  });
  it('returns null when nothing can be checked', () => {
    const g = mockBuyingGuide('2026-01-15', '09:00', 90);
    expect(guideCheck({ ...g, hours: g.hours.map((h) => ({ ...h, actual: null })) })).toBeNull();
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

describe('buildTakeaways', () => {
  const pt = (error: number | null) => ({ time: 't', actual: 1, forecast: 1, publish_time: null, horizon_h: null, error });
  const metrics = { ...emptyMetricsForTakeaways(), bias: 1750, p90: 4150 };
  const daily = [
    { date: '2026-01-27', mae: 900, bias: 0, actual_mean: 9000, forecast_mean: 9100, count: 24 },
    { date: '2026-01-28', mae: 5329, bias: 5329, actual_mean: 5805.6, forecast_mean: 11134.6, count: 24 },
  ];

  it('summarises direction, margin and worst day', () => {
    const t = buildTakeaways({ series: [pt(100), pt(200), pt(-50), pt(null)], metrics, daily });
    expect(t.map((x) => x.key)).toEqual(['direction', 'margin', 'worst']);
    expect(t[0]!.headline).toBe('Too high in 67% of hours');
    expect(t[0]!.tone).toBe('warn');
    expect(t[1]!.headline).toBe('Plan on 4.15 GW less wind');
    expect(t[2]!.headline).toContain('28 Jan 2026');
    expect(t[2]!.detail).toBe('Forecast 11.13 GW against actual 5.81 GW on average that day.');
  });

  it('handles under-forecasting and no margin', () => {
    const t = buildTakeaways({ series: [pt(-100), pt(-200)], metrics: { ...metrics, bias: -150, p90: -10 }, daily: [] });
    expect(t[0]!.headline).toBe('Too low in 100% of hours');
    expect(t[1]!.headline).toBe('Little margin needed');
    expect(t).toHaveLength(2);
  });

  it('returns nothing without data', () => {
    expect(buildTakeaways({ series: [], metrics: emptyMetricsForTakeaways(), daily: [] })).toEqual([]);
  });
});

function emptyMetricsForTakeaways() {
  return {
    count: 0, mae: null, rmse: null, bias: null, nmae_pct: null, mean_actual: null,
    p10: null, p50: null, p90: null, max_over: null, max_under: null, coverage_pct: null,
  };
}
