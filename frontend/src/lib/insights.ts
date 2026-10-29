import type { BuyingGuide, Metrics } from '../api/types';
import { describeBias, formatCount, formatGW, formatGWh, formatPct, formatSignedGW } from './format';

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
      info: 'Average of (forecast − actual). Positive means forecasts are usually too high, so you would tend to be short of power.',
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
        : `9 in 10 hours, the forecast was too low or spot on — it rarely over-promised.`,
    );
  }
  if (m.p10 !== null) {
    out.push(
      m.p10 < 0
        ? `9 in 10 hours, it was no more than ${formatGW(-m.p10)} too low.`
        : `9 in 10 hours, the forecast was at least ${formatGW(m.p10)} too high — a steady over-forecast.`,
    );
  }
  if (m.p50 !== null) out.push(`The middle (typical) error was ${formatSignedGW(m.p50)}.`);
  return out;
}

export function buyingSentence(g: BuyingGuide): string | null {
  if (g.totals.safe_mwh === null) return null;
  return `Plan on at least ${formatGWh(g.totals.safe_mwh)} of wind; buy the rest from the market.`;
}

/** Hindsight check: did the real wind cover the planned amount, hour by hour? */
export function hindsight(g: BuyingGuide): string | null {
  const scored = g.hours.filter((h) => h.actual !== null && h.safe_wind !== null);
  if (!scored.length || g.totals.actual_mwh === null) return null;
  const short = scored.filter((h) => (h.actual as number) < (h.safe_wind as number)).length;
  const head = `In hindsight, ${formatGWh(g.totals.actual_mwh)} of wind actually came.`;
  return short === 0
    ? `${head} The planned amount was covered in every hour.`
    : `${head} Wind fell below the plan in ${short} of ${scored.length} hours.`;
}

