import { useEffect, useId, useState } from 'react';
import type { Mode } from '../api/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { addDays, daysBetweenInclusive } from '../lib/dates';
import { type Bounds, CUTOFF_OPTIONS, type DashboardState } from '../lib/urlState';
import type { SetStateOptions } from '../hooks/useUrlState';
import { Segmented } from './Segmented';

interface Props {
  state: DashboardState;
  bounds: Bounds;
  setState: (patch: Partial<DashboardState>, opts?: SetStateOptions) => void;
}

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'deadline', label: 'Decision deadline' },
  { value: 'horizon', label: 'Forecast horizon' },
];

export function Controls({ state, bounds, setState }: Props) {
  const ids = { start: useId(), end: useId(), cutoff: useId(), horizon: useId(), horizonHint: useId() };

  // The slider moves instantly; the URL (and so the fetch) follows after a short pause.
  const [horizonDraft, setHorizonDraft] = useState(state.horizon);
  const debounced = useDebouncedValue(horizonDraft, 300);
  useEffect(() => setHorizonDraft(state.horizon), [state.horizon]); // back/forward
  useEffect(() => {
    if (debounced !== state.horizon) setState({ horizon: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const onStart = (v: string) => {
    if (!v) return;
    setState(v > state.end ? { start: v, end: v } : { start: v });
  };
  const onEnd = (v: string) => {
    if (!v) return;
    setState(v < state.start ? { start: v, end: v } : { end: v });
  };
  const days = daysBetweenInclusive(state.start, state.end);
  const isAll = state.start === bounds.min && state.end === bounds.max;
  const last7 = addDays(bounds.max, -6);

  return (
    <form className="controls" aria-label="Analysis settings" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="controls__group">
        <legend>Delivery days</legend>
        <div className="controls__dates">
          <label htmlFor={ids.start}>From</label>
          <input
            id={ids.start}
            type="date"
            value={state.start}
            min={bounds.min}
            max={bounds.max}
            required
            onChange={(e) => onStart(e.target.value)}
          />
          <label htmlFor={ids.end}>To</label>
          <input
            id={ids.end}
            type="date"
            value={state.end}
            min={bounds.min}
            max={bounds.max}
            required
            onChange={(e) => onEnd(e.target.value)}
          />
        </div>
        <div className="controls__presets">
          <span className="muted">{days} {days === 1 ? 'day' : 'days'}</span>
          <button type="button" className="link-btn" disabled={isAll} onClick={() => setState({ start: bounds.min, end: bounds.max })}>
            All
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={state.start === last7 && state.end === bounds.max}
            onClick={() => setState({ start: last7 < bounds.min ? bounds.min : last7, end: bounds.max })}
          >
            Last 7 days
          </button>
        </div>
      </fieldset>

      <fieldset className="controls__group">
        <legend>Which forecast to use</legend>
        <Segmented label="Forecast selection rule" options={MODE_OPTIONS} value={state.mode} onChange={(mode) => setState({ mode })} />
      </fieldset>

      {state.mode === 'deadline' ? (
        <fieldset className="controls__group">
          <legend>
            <label htmlFor={ids.cutoff}>Cut-off time (UK, day before)</label>
          </legend>
          <select id={ids.cutoff} value={state.cutoff} onChange={(e) => setState({ cutoff: e.target.value })}>
            {CUTOFF_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </fieldset>
      ) : (
        <fieldset className="controls__group controls__group--wide">
          <legend>
            <label htmlFor={ids.horizon}>
              Look-ahead: <output aria-live="polite">{horizonDraft} h</output>
            </label>
          </legend>
          <input
            id={ids.horizon}
            type="range"
            min={0}
            max={bounds.maxHorizon}
            step={1}
            value={horizonDraft}
            aria-describedby={ids.horizonHint}
            aria-valuetext={`${horizonDraft} hours before delivery`}
            onChange={(e) => setHorizonDraft(Number(e.target.value))}
          />
          <p id={ids.horizonHint} className="muted small">
            Use the latest forecast published at least this many hours before each hour.
          </p>
        </fieldset>
      )}
    </form>
  );
}
