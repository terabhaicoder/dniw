import { memo, useMemo, useState } from 'react';
import type { DailyStat } from '../api/types';
import { dailyScale } from '../lib/chartData';
import { formatDay } from '../lib/dates';
import { formatGW, formatSignedGW } from '../lib/format';

type SortKey = 'date' | 'mae' | 'bias';

function Bar({ value, scale, signed }: { value: number | null; scale: number; signed?: boolean }) {
  if (value === null) return null;
  const pct = Math.min(100, (Math.abs(value) / scale) * 100);
  const cls = signed ? (value > 0 ? 'mini-bar--over' : 'mini-bar--under') : '';
  return (
    <span className={`mini-bar ${signed ? 'mini-bar--signed' : ''}`} aria-hidden="true">
      <span
        className={`mini-bar__fill ${cls}`}
        style={signed ? { width: `${pct / 2}%`, [value > 0 ? 'left' : 'right']: '50%' } : { width: `${pct}%` }}
      />
    </span>
  );
}

export const DailyTable = memo(function DailyTable({
  rows,
  selectedDay,
  onSelectDay,
}: {
  rows: DailyStat[];
  selectedDay?: string;
  onSelectDay?: (d: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'date', desc: false });
  const scale = useMemo(() => dailyScale(rows), [rows]);
  const sorted = useMemo(() => {
    const val = (r: DailyStat) => (sort.key === 'date' ? r.date : sort.key === 'mae' ? r.mae ?? -Infinity : Math.abs(r.bias ?? 0));
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [rows, sort]);

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
        <button
          type="button"
          className="th-btn"
          onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'date' }))}
        >
          {label}
          <span aria-hidden="true">{active ? (sort.desc ? ' ▼' : ' ▲') : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="table-wrap" tabIndex={0} aria-label="Daily accuracy table, scrollable">
      <table className="daily">
        <caption className="visually-hidden">Average error and bias per delivery day. Select a day to open it in the buying guide.</caption>
        <thead>
          <tr>
            {header('date', 'Day')}
            {header('mae', 'Avg error')}
            {header('bias', 'Bias')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.date} className={r.date === selectedDay ? 'is-selected' : undefined}>
              <th scope="row">
                {onSelectDay ? (
                  <button type="button" className="link-btn" onClick={() => onSelectDay(r.date)} title="Open in buying guide">
                    {formatDay(r.date)}
                  </button>
                ) : (
                  formatDay(r.date)
                )}
              </th>
              <td>
                <span className="num">{formatGW(r.mae)}</span>
                <Bar value={r.mae} scale={scale} />
              </td>
              <td>
                <span className="num">{formatSignedGW(r.bias)}</span>
                <Bar value={r.bias} scale={scale} signed />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
