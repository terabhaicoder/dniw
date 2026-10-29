import { memo, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourStat } from '../api/types';
import { gwFormatter, toHourRows } from '../lib/chartData';
import { useTheme } from '../hooks/useTheme';

export const HourOfDayChart = memo(function HourOfDayChart({ rows }: { rows: HourStat[] }) {
  const { colors } = useTheme();
  const data = useMemo(() => toHourRows(rows), [rows]);
  const worst = useMemo(
    () => data.reduce<(typeof data)[number] | null>((w, r) => (r.mae !== null && (w === null || (w.mae ?? -1) < r.mae) ? r : w), null),
    [data],
  );
  return (
    <>
      <div className="chart" role="img" aria-label="Bar chart of average error and bias for each hour of the day, UK time.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={1}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="label" stroke={colors.axis} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis stroke={colors.axis} tick={{ fontSize: 12 }} width={40} tickFormatter={(v: number) => v.toFixed(1)} />
            <Tooltip formatter={gwFormatter} labelFormatter={(l: string) => `${l} UK`} />
            <Legend verticalAlign="top" height={28} />
            <ReferenceLine y={0} stroke={colors.axis} />
            <Bar name="Average error (MAE)" dataKey="mae" fill={colors.forecast} isAnimationActive={false} />
            <Bar name="Bias" dataKey="bias" fill={colors.safe} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {worst && worst.mae !== null && (
        <p className="takeaway">
          Hardest hour to forecast: <strong>{worst.label}</strong> (average error {worst.mae.toFixed(2)} GW).
        </p>
      )}
    </>
  );
});
