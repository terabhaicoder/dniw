import { memo, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BuyingGuide, Confidence, DailyStat } from '../api/types';
import { useBuyingGuide } from '../hooks/queries';
import { gwFormatter } from '../lib/chartData';
import { useTheme } from '../hooks/useTheme';
import { addDays, formatDay, formatUkTime } from '../lib/dates';
import { guideFileName, guideToCsv, downloadText } from '../lib/csv';
import { formatGW, formatGWh, toGW } from '../lib/format';
import { guideCheck } from '../lib/insights';
import { DayCalendar } from './DayCalendar';
import { CONFIDENCES } from '../lib/urlState';
import { Panel } from './Panel';
import { Segmented } from './Segmented';
import { EmptyState, ErrorState, Skeleton } from './States';

const Chart = memo(function Chart({ guide }: { guide: BuyingGuide }) {
  const { colors } = useTheme();
  const rows = useMemo(
    () =>
      guide.hours.map((h) => ({
        t: Date.parse(h.time),
        forecast: toGW(h.forecast),
        safe: toGW(h.safe_wind),
        actual: toGW(h.actual),
        buffer:
          h.forecast !== null && h.safe_wind !== null ? [toGW(h.safe_wind) as number, toGW(h.forecast) as number] : null,
      })),
    [guide.hours],
  );
  return (
    <div className="chart" role="img" aria-label={`Hourly chart for ${formatDay(guide.date)}: forecast, safe wind to plan on, and actual wind.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatUkTime} stroke={colors.axis} tick={{ fontSize: 12 }} minTickGap={20} />
          <YAxis stroke={colors.axis} tick={{ fontSize: 12 }} width={44} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: colors.axis, fontSize: 12 }} />
          <Tooltip
            labelFormatter={(t: number) => `${formatUkTime(t)} UK`}
            formatter={(v: unknown, name: unknown) =>
              Array.isArray(v) ? [`${(v[1] - v[0]).toFixed(2)} GW`, String(name)] : gwFormatter(v, name)
            }
          />
          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
          <Area name="Safety buffer" dataKey="buffer" stroke="none" fill={colors.safe} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} />
          <Line name="Safe wind to plan on" dataKey="safe" stroke={colors.safe} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line name="Forecast" dataKey="forecast" stroke={colors.forecast} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line name="Actual (hindsight)" dataKey="actual" stroke={colors.actual} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

interface Props {
  start: string;
  end: string;
  day: string;
  cutoff: string;
  confidence: Confidence;
  modeIsHorizon: boolean;
  daily?: DailyStat[];
  onChange: (patch: { day?: string; confidence?: Confidence }) => void;
}

export function BuyingGuidePanel({ start, end, day, cutoff, confidence, modeIsHorizon, daily, onChange }: Props) {
  const q = useBuyingGuide(day, cutoff, confidence);
  const g = q.data;
  const check = g ? guideCheck(g) : null;
  const buffer =
    g && g.totals.forecast_mwh !== null && g.totals.safe_mwh !== null ? g.totals.forecast_mwh - g.totals.safe_mwh : null;
  const prev = day > start ? addDays(day, -1) : null;
  const next = day < end ? addDays(day, 1) : null;

  return (
    <Panel
      id="buying"
      title="Buying guide"
      subtitle={`How much wind to rely on for one delivery day, using the ${cutoff} UK forecast from the day before.`}
      info="The safety buffer comes from forecast errors on all other days at the same cut-off, so the chosen day's own result is not used to size it."
      busy={q.isFetching && !!g}
      className="panel--wide"
      actions={
        <button type="button" className="btn btn--ghost" disabled={!g} onClick={() => g && downloadText(guideFileName(g), guideToCsv(g))}>
          Download day CSV
        </button>
      }
    >
      <div className="guide">
        <aside className="guide__picker">
          <span className="field__label">Delivery day</span>
          <DayCalendar start={start} end={end} selected={day} daily={daily} onSelect={(d) => onChange({ day: d })} />
          <span className="field__label">How sure do you want to be?</span>
          <Segmented<Confidence>
            label="Confidence level"
            options={CONFIDENCES.map((c) => ({ value: c, label: `${c}%` }))}
            value={confidence}
            onChange={(c) => onChange({ confidence: c })}
          />
          {modeIsHorizon && <p className="note">The buying guide always uses the decision deadline ({cutoff} UK).</p>}
        </aside>

        <div className="guide__result">
          <div className="guide__dayhead">
            <button type="button" className="icon-btn" aria-label="Previous day" disabled={!prev} onClick={() => prev && onChange({ day: prev })}>
              ‹
            </button>
            <h3 className="guide__day">{formatDay(day)}</h3>
            <button type="button" className="icon-btn" aria-label="Next day" disabled={!next} onClick={() => next && onChange({ day: next })}>
              ›
            </button>
          </div>

          {q.isPending ? (
            <Skeleton height={180} label="Loading buying guide" />
          ) : q.isError && !g ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : !g || g.hours.length === 0 || g.totals.safe_mwh === null ? (
            <EmptyState title="No forecast for this day" text="Try another delivery day or cut-off time." />
          ) : (
            <>
              <div className="equation" aria-live="polite">
                <div className="equation__item">
                  <span>Forecast wind</span>
                  <strong>{formatGWh(g.totals.forecast_mwh)}</strong>
                </div>
                <span className="equation__op" aria-hidden="true">−</span>
                <div className="equation__item">
                  <span>Safety buffer</span>
                  <strong>{formatGWh(buffer)}</strong>
                  <small>{formatGW(g.margin_mw)} each hour</small>
                </div>
                <span className="equation__op" aria-hidden="true">=</span>
                <div className="equation__item equation__item--key">
                  <span>Wind to rely on</span>
                  <strong>{formatGWh(g.totals.safe_mwh)}</strong>
                  <small>{g.confidence}% confidence</small>
                </div>
              </div>
              <p className="guide__advice">Buy the rest of your demand from the day-ahead market.</p>
              {check && (
                <p className={`status ${check.short === 0 ? 'status--good' : 'status--warn'}`}>
                  <span aria-hidden="true">{check.short === 0 ? '✓' : '!'}</span>
                  {check.short === 0
                    ? `In hindsight the plan held: real wind (${formatGWh(g.totals.actual_mwh)}) covered it in all ${check.scored} hours.`
                    : `In hindsight real wind fell short of the plan in ${check.short} of ${check.scored} hours (actual ${formatGWh(g.totals.actual_mwh)}).`}
                </p>
              )}
              <p className="muted small">
                With about {g.confidence}% confidence, real wind will be at least the planned level in any hour. A higher
                confidence means a bigger buffer and more power bought from the market.
              </p>
            </>
          )}
        </div>
      </div>

      {g && g.hours.length > 0 && <Chart guide={g} />}
    </Panel>
  );
}
