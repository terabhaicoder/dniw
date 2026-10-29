import { memo, useMemo } from 'react';
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { SeriesPoint } from '../api/types';
import { type SeriesRow, toSeriesRows } from '../lib/chartData';
import { formatUkDateTime, formatUkShortDate, formatUkTime } from '../lib/dates';
import { formatHours } from '../lib/format';
import { useTheme } from '../hooks/useTheme';

function fmt(v: number | null | undefined) {
  return typeof v === 'number' ? `${v.toFixed(2)} GW` : 'no data';
}

function SeriesTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as SeriesRow | undefined;
  if (!active || !row) return null;
  const err = row.error;
  return (
    <div className="chart-tip">
      <p className="chart-tip__title">{formatUkDateTime(new Date(row.t).toISOString())} UK</p>
      <dl>
        <dt>Actual</dt>
        <dd>{fmt(row.actual)}</dd>
        <dt>Forecast</dt>
        <dd>{fmt(row.forecast)}</dd>
        <dt>Error</dt>
        <dd>
          {typeof err === 'number' ? `${err > 0 ? '+' : ''}${err.toFixed(2)} GW ${err > 0 ? '(too high)' : err < 0 ? '(too low)' : ''}` : 'n/a'}
        </dd>
        <dt>Forecast published</dt>
        <dd>{row.publish ? `${formatUkDateTime(row.publish)} UK` : 'none available'}</dd>
        <dt>Look-ahead</dt>
        <dd>{formatHours(row.horizon)}</dd>
      </dl>
    </div>
  );
}

export const SeriesChart = memo(function SeriesChart({ series }: { series: SeriesPoint[] }) {
  const { colors } = useTheme();
  const rows = useMemo(() => toSeriesRows(series), [series]);
  const multiDay = rows.length > 48;

  return (
    <div
      className="chart chart--tall"
      role="img"
      aria-label={`Line chart of actual and forecast national wind output, ${rows.length} hourly points. Drag the handles under the chart to zoom.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => (multiDay ? formatUkShortDate(t) : formatUkTime(t))}
            stroke={colors.axis}
            tick={{ fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            stroke={colors.axis}
            tick={{ fontSize: 12 }}
            width={48}
            tickFormatter={(v: number) => `${v}`}
            label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: colors.axis, fontSize: 12 }}
          />
          <Tooltip content={<SeriesTooltip />} />
          <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ paddingBottom: 8 }} />
          <Line
            name="Actual"
            dataKey="actual"
            stroke={colors.actual}
            strokeWidth={1.6}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            name="Forecast"
            dataKey="forecast"
            stroke={colors.forecast}
            strokeWidth={1.6}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {rows.length > 24 && (
            <Brush
              dataKey="t"
              height={26}
              travellerWidth={10}
              stroke={colors.forecast}
              fill="transparent"
              tickFormatter={(t: number) => formatUkShortDate(t)}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
