import { type CSSProperties, memo, useMemo } from 'react';
import type { DailyStat } from '../api/types';
import { dateRange, formatDay } from '../lib/dates';
import { formatGW } from '../lib/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  start: string;
  end: string;
  selected: string;
  daily?: DailyStat[];
  onSelect: (day: string) => void;
}

/** Month-style grid of delivery days, shaded by that day's average forecast error. */
export const DayCalendar = memo(function DayCalendar({ start, end, selected, daily, onSelect }: Props) {
  const { cells, maxMae } = useMemo(() => {
    const byDay = new Map((daily ?? []).map((d) => [d.date, d.mae]));
    const days = dateRange(start, end);
    // Pad to start on a Monday (getUTCDay: 0 = Sunday).
    const lead = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
    const max = Math.max(0, ...days.map((d) => byDay.get(d) ?? 0));
    return {
      maxMae: max,
      cells: [...Array<null>(lead).fill(null), ...days.map((d) => ({ day: d, mae: byDay.get(d) ?? null }))],
    };
  }, [start, end, daily]);

  return (
    <div className="cal">
      <div className="cal__grid" role="group" aria-label="Choose a delivery day">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal__weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <span key={`pad-${i}`} aria-hidden="true" />
          ) : (
            <button
              key={c.day}
              type="button"
              className={`cal__day${c.day === selected ? ' is-selected' : ''}`}
              style={{ '--heat': c.mae !== null && maxMae > 0 ? (c.mae / maxMae).toFixed(2) : 0 } as CSSProperties}
              aria-pressed={c.day === selected}
              aria-label={`${formatDay(c.day)}${c.mae !== null ? `, average error ${formatGW(c.mae)}` : ''}`}
              title={c.mae !== null ? `Average error ${formatGW(c.mae)}` : undefined}
              onClick={() => onSelect(c.day)}
            >
              {Number(c.day.slice(8))}
              {c.day.slice(8) === '01' && <small>{formatDay(c.day).split(' ')[2]}</small>}
            </button>
          ),
        )}
      </div>
      <div className="cal__legend" aria-hidden="true">
        <span>Smaller miss</span>
        <span className="cal__scale" />
        <span>Bigger miss</span>
      </div>
    </div>
  );
});
