import { ApiError } from '../api/client';

export function Skeleton({ height = 240, label = 'Loading' }: { height?: number; label?: string }) {
  return (
    <div className="skeleton" style={{ height }} role="status" aria-live="polite">
      <span className="visually-hidden">{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg =
    error instanceof ApiError
      ? error.message
      : 'Something went wrong while loading this data.';
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Could not load this section</p>
      <p className="state__text">{msg}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="state state--empty" role="status">
      <p className="state__title">{title}</p>
      {text && <p className="state__text">{text}</p>}
    </div>
  );
}
