import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HorizonPoint } from '../api/types';
import { gwFormatter, toHorizonRows } from '../lib/chartData';
import { useTheme } from '../hooks/useTheme';

export const HorizonCurve = memo(function HorizonCurve({
  points,
  marker,
  markerLabel,
}: {
  points: HorizonPoint[];
  marker: number | null;
  markerLabel: string;
}) {
  const { colors } = useTheme();
  const rows = useMemo(() => toHorizonRows(points), [points]);
  const first = rows.find((r) => r.mae !== null);
  const last = [...rows].reverse().find((r) => r.mae !== null);
  const summary =
    first && last && first !== last && first.mae !== null && last.mae !== null
      ? `Average error grows from ${first.mae.toFixed(2)} GW at ${first.h} h ahead to ${last.mae.toFixed(2)} GW at ${last.h} h ahead.`
      : '';

  return (
    <>
      <div className="chart" role="img" aria-label={`Line chart of forecast error against look-ahead time. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="h"
              type="number"
              domain={[0, 48]}
              ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
              stroke={colors.axis}
              tick={{ fontSize: 12 }}
              label={{ value: 'Hours ahead', position: 'insideBottom', offset: -2, fill: colors.axis, fontSize: 11 }}
              height={36}
            />
            <YAxis stroke={colors.axis} tick={{ fontSize: 12 }} width={40} tickFormatter={(v: number) => v.toFixed(1)} />
            <Tooltip
              formatter={gwFormatter}
              labelFormatter={(h: number) => `${h} hours ahead`}
            />
            <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
            {marker !== null && (
              <ReferenceLine
                x={marker}
                stroke={colors.accent}
                strokeWidth={2}
                label={{ value: markerLabel, position: 'insideTopRight', fill: colors.accent, fontSize: 11 }}
              />
            )}
            <Line name="Average error (MAE)" dataKey="mae" stroke={colors.forecast} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line name="Big-miss error (RMSE)" dataKey="rmse" stroke={colors.safe} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {summary && <p className="takeaway">{summary}</p>}
    </>
  );
});
