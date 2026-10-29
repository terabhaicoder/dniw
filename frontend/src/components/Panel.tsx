import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

interface Props {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  info?: string;
  actions?: ReactNode;
  /** Data is being refreshed in the background: dim the content, keep the layout. */
  busy?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({ id, title, subtitle, info, actions, busy, className, children }: Props) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`panel ${className ?? ''}`} aria-labelledby={headingId} aria-busy={busy || undefined}>
      <header className="panel__head">
        <div className="panel__titles">
          <h2 className="panel__title" id={headingId}>
            {title}
            {info && <InfoTip text={info} label={`About: ${title}`} />}
          </h2>
          {subtitle && <p className="panel__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className={`panel__body${busy ? ' is-busy' : ''}`}>{children}</div>
    </section>
  );
}
