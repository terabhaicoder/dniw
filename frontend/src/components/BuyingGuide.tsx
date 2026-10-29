import { memo, useId, useMemo } from 'react';
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
import type { BuyingGuide, Confidence } from '../api/types';
import { useBuyingGuide } from '../hooks/queries';
import { gwFormatter } from '../lib/chartData';
import { useTheme } from '../hooks/useTheme';
import { dateRange, formatDay, formatUkTime } from '../lib/dates';
import { formatGW, formatGWh, toGW } from '../lib/format';
import { buyingSentence, hindsight } from '../lib/insights';
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
            formatter={gwFormatter}
          />
          <Legend verticalAlign="top" height={28} />
          <Area name="Safe wind to plan on" dataKey="safe" stroke={colors.safe} fill={colors.safe} fillOpacity={0.2} connectNulls={false} isAnimationActive={false} />
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
  onChange: (patch: { day?: string; confidence?: Confidence }) => void;
}

export function BuyingGuidePanel({ start, end, day, cutoff, confidence, modeIsHorizon, onChange }: Props) {
  const dayId = useId();
  const days = useMemo(() => dateRange(start, end), [start, end]);
  const q = useBuyingGuide(day, cutoff, confidence);
  const g = q.data;

  return (
    <Panel
      id="buying"
      title="Buying guide"
      subtitle={`How much wind to count on for one delivery day, using the ${cutoff} UK forecast from the day before.`}
      info="The safety margin comes from forecast errors on all other days at the same cut-off, so the chosen day's own result is not used to size it."
      busy={q.isFetching && !!g}
      className="panel--wide"
    >
      <div className="guide-controls">
        <div className="field">
          <label htmlFor={dayId}>Delivery day</label>
          <select id={dayId} value={day} onChange={(e) => onChange({ day: e.target.value })}>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="field__label" id={`${dayId}-conf`}>How sure do you want to be?</span>
          <Segmented<Confidence>
            label="Confidence level"
            options={CONFIDENCES.map((c) => ({ value: c, label: `${c}%` }))}
            value={confidence}
            onChange={(c) => onChange({ confidence: c })}
          />
        </div>
      </div>
      {modeIsHorizon && (
        <p className="note">The buying guide always uses a decision deadline (cut-off {cutoff}), even in horizon mode.</p>
      )}

      {q.isPending ? (
        <Skeleton height={300} label="Loading buying guide" />
      ) : q.isError && !g ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !g || g.hours.length === 0 ? (
        <EmptyState title="No forecast for this day" text="Try another delivery day or cut-off time." />
      ) : (
        <>
          <p className="headline" aria-live="polite">
            {buyingSentence(g) ?? 'Not enough data to suggest a plan for this day.'}
          </p>
          <dl className="totals">
            <div>
              <dt>Forecast total</dt>
              <dd>{formatGWh(g.totals.forecast_mwh)}</dd>
            </div>
            <div className="totals__key">
              <dt>Safe to plan on ({g.confidence}%)</dt>
              <dd>{formatGWh(g.totals.safe_mwh)}</dd>
            </div>
            <div>
              <dt>Safety margin per hour</dt>
              <dd>{formatGW(g.margin_mw)}</dd>
            </div>
            <div>
              <dt>Actual (hindsight)</dt>
              <dd>{formatGWh(g.totals.actual_mwh)}</dd>
            </div>
          </dl>
          <Chart guide={g} />
          {hindsight(g) && <p className="takeaway">{hindsight(g)}</p>}
          <p className="muted small">
            With about {g.confidence}% confidence, actual wind will be at least the safe amount in any hour. Higher
            confidence means a bigger margin and more power bought from the market.
          </p>
        </>
      )}
    </Panel>
  );
}
