import type { Analysis, BuyingGuide, Metrics } from '../api/types';
import { formatDay } from './dates';
import { describeBias, formatCount, formatGW, formatPct, formatSignedGW } from './format';

/* Plain-English text derived from API numbers. Pure functions: easy to test. */

export interface KpiCard {
  key: string;
  label: string;
  value: string;
  note: string;
  info: string;
  tone?: 'warn' | 'good';
}

export function buildCards(m: Metrics): KpiCard[] {
  return [
    {
      key: 'mae',
      label: 'Average error (MAE)',
      value: formatGW(m.mae),
      note: `Typical miss per hour, over ${formatCount(m.count)} hours`,
      info: 'Mean Absolute Error: the average size of the miss, ignoring whether the forecast was too high or too low.',
    },
    {
      key: 'rmse',
      label: 'Big-miss error (RMSE)',
      value: formatGW(m.rmse),
      note: 'Higher than MAE when some misses are large',
      info: 'Root Mean Square Error: like the average error, but large misses count much more. Useful for sizing a safety margin.',
    },
    {
      key: 'bias',
      label: 'Bias',
      value: formatSignedGW(m.bias),
      note: describeBias(m.bias),
      info: 'Average of (forecast minus actual). Positive means forecasts are usually too high, so you would tend to be short of power.',
      tone: m.bias !== null && m.bias > 50 ? 'warn' : undefined,
    },
    {
      key: 'nmae',
      label: 'Error as % of average wind',
      value: formatPct(m.nmae_pct),
      note: `Average wind was ${formatGW(m.mean_actual)}`,
      info: 'Average error divided by average actual wind output. Lets you compare periods with more or less wind.',
    },
    {
      key: 'coverage',
      label: 'Coverage',
      value: formatPct(m.coverage_pct),
      note: 'Hours that had a usable forecast',
      info: 'Share of target hours where a forecast was available under the chosen rule. Hours without one are left out of the numbers.',
      tone: m.coverage_pct !== null && m.coverage_pct < 95 ? 'warn' : undefined,
    },
  ];
}

/** Plain-English reading of the error percentiles (MW in, words out). */
export function describePercentiles(m: Pick<Metrics, 'p10' | 'p50' | 'p90'>): string[] {
  const out: string[] = [];
  if (m.p90 !== null) {
    out.push(
      m.p90 > 0
        ? `9 in 10 hours, the forecast was no more than ${formatGW(m.p90)} too high.`
        : `9 in 10 hours, the forecast was too low or spot on. It rarely over-promised.`,
    );
  }
  if (m.p10 !== null) {
    out.push(
      m.p10 < 0
        ? `9 in 10 hours, it was no more than ${formatGW(-m.p10)} too low.`
        : `9 in 10 hours, the forecast was at least ${formatGW(m.p10)} too high. A steady over-forecast.`,
    );
  }
  if (m.p50 !== null) out.push(`The middle (typical) error was ${formatSignedGW(m.p50)}.`);
  return out;
}

export interface Takeaway {
  key: string;
  label: string;
  headline: string;
  detail: string;
  tone?: 'warn' | 'good';
}

/** The three things a buyer should know first, in plain words. */
export function buildTakeaways(a: Pick<Analysis, 'series' | 'metrics' | 'daily'>): Takeaway[] {
  const out: Takeaway[] = [];
  const errors = a.series.map((p) => p.error).filter((e): e is number => e !== null);
  const { bias, p90 } = a.metrics;

  if (errors.length && bias !== null) {
    const high = bias >= 0;
    const share = Math.round((errors.filter((e) => (high ? e > 0 : e < 0)).length / errors.length) * 100);
    out.push({
      key: 'direction',
      label: 'Direction of the miss',
      headline: `Too ${high ? 'high' : 'low'} in ${share}% of hours`,
      detail: high
        ? `Forecasts ran ${formatGW(bias)} high on average, so relying on them would often leave you short.`
        : `Forecasts ran ${formatGW(-bias)} low on average, so you would often buy more than needed.`,
      tone: high && share >= 60 ? 'warn' : undefined,
    });
  }

  if (p90 !== null) {
    out.push(
      p90 > 0
        ? {
            key: 'margin',
            label: 'Safety margin',
            headline: `Plan on ${formatGW(p90)} less wind`,
            detail: 'Taking this off the forecast would have covered 9 hours in 10.',
          }
        : {
            key: 'margin',
            label: 'Safety margin',
            headline: 'Little margin needed',
            detail: 'The forecast was too high in fewer than 1 hour in 10.',
            tone: 'good',
          },
    );
  }

  const worst = a.daily.reduce<Analysis['daily'][number] | null>(
    (w, d) => (d.mae !== null && (w === null || (w.mae ?? -1) < d.mae) ? d : w),
    null,
  );
  if (worst && worst.mae !== null) {
    out.push({
      key: 'worst',
      label: 'Worst day',
      headline: formatDay(worst.date),
      detail: `Forecast ${formatGW(worst.forecast_mean)} against actual ${formatGW(worst.actual_mean)} on average that day.`,
    });
  }
  return out;
}

export interface GuideCheck {
  scored: number;
  short: number;
}

/** Hindsight check of a plan: in how many hours did real wind fall below the safe level? */
export function guideCheck(g: BuyingGuide): GuideCheck | null {
  const scored = g.hours.filter((h) => h.actual !== null && h.safe_wind !== null);
  if (!scored.length) return null;
  return { scored: scored.length, short: scored.filter((h) => (h.actual as number) < (h.safe_wind as number)).length };
}
