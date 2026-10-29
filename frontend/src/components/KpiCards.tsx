import { memo } from 'react';
import type { Metrics } from '../api/types';
import { buildCards } from '../lib/insights';
import { InfoTip } from './InfoTip';

export const KpiCards = memo(function KpiCards({ metrics }: { metrics: Metrics }) {
  const cards = buildCards(metrics);
  return (
    <ul className="kpis" aria-label="Key accuracy numbers">
      {cards.map((c) => (
        <li key={c.key} className={`kpi${c.tone ? ` kpi--${c.tone}` : ''}`}>
          <span className="kpi__label">
            {c.label}
            <InfoTip text={c.info} label={`What is ${c.label}?`} />
          </span>
          <span className="kpi__value">{c.value}</span>
          <span className="kpi__note">{c.note}</span>
        </li>
      ))}
    </ul>
  );
});

export function KpiSkeleton() {
  return (
    <ul className="kpis" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="kpi kpi--skeleton">
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--big" />
          <span className="skeleton skeleton--line" />
        </li>
      ))}
    </ul>
  );
}
