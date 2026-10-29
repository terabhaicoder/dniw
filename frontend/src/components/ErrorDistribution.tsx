import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistogramBin, Metrics } from '../api/types';
import { toHistogramRows } from '../lib/chartData';
import { describePercentiles } from '../lib/insights';
import { useTheme } from '../hooks/useTheme';

export const ErrorDistribution = memo(function ErrorDistribution({
  histogram,
  metrics,
}: {
  histogram: HistogramBin[];
  metrics: Metrics;
}) {
  const { colors } = useTheme();
  const rows = useMemo(() => toHistogramRows(histogram), [histogram]);
  const lines = useMemo(() => describePercentiles(metrics), [metrics]);
  const marks: [string, number][] = [];
  for (const [label, v] of [['P10', metrics.p10], ['P50', metrics.p50], ['P90', metrics.p90]] as const) {
    if (v !== null) marks.push([label, v]);
  }

  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`Histogram of hourly forecast errors in GW with P10, P50 and P90 markers. ${lines.join(' ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              stroke={colors.axis}
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => v.toFixed(1)}
              label={{ value: 'Error (GW)  ← too low | too high →', position: 'insideBottom', offset: -2, fill: colors.axis, fontSize: 11 }}
              height={36}
            />
            <YAxis stroke={colors.axis} tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
            <Tooltip
              formatter={(v: unknown) => [`${String(v)} hours`, 'Count']}
              labelFormatter={(x: unknown) => (typeof x === 'number' ? `From ${x.toFixed(2)} GW` : '')}
            />
            <Area
              type="stepAfter"
              dataKey="count"
              stroke={colors.fill}
              fill={colors.fill}
              fillOpacity={0.25}
              isAnimationActive={false}
            />
            <ReferenceLine x={0} stroke={colors.axis} strokeOpacity={0.6} />
            {marks.map(([label, v]) => (
              <ReferenceLine
                key={label}
                x={v / 1000}
                stroke={label === 'P50' ? colors.accent : v > 0 ? colors.over : colors.under}
                strokeDasharray="4 3"
                label={{ value: label, position: 'top', fill: colors.axis, fontSize: 11 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="takeaways">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </>
  );
});
