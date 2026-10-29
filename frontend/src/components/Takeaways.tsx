import { memo } from 'react';
import type { Analysis } from '../api/types';
import { buildTakeaways } from '../lib/insights';

export const Takeaways = memo(function Takeaways({ analysis }: { analysis: Analysis }) {
  const items = buildTakeaways(analysis);
  if (!items.length) return null;
  return (
    <ul className="takeaway-cards" aria-label="Key takeaways">
      {items.map((t) => (
        <li key={t.key} className={`takeaway-card${t.tone ? ` takeaway-card--${t.tone}` : ''}`}>
          <span className="takeaway-card__label">{t.label}</span>
          <strong className="takeaway-card__headline">{t.headline}</strong>
          <span className="takeaway-card__detail">{t.detail}</span>
        </li>
      ))}
    </ul>
  );
});
