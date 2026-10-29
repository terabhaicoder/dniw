import { useCallback, useMemo } from 'react';
import type { AnalysisParams } from '../api/types';
import { useAnalysis, useHorizonCurve, useMeta } from '../hooks/queries';
import { useUrlState } from '../hooks/useUrlState';
import { medianHorizon } from '../lib/chartData';
import { csvFileName, downloadText, seriesToCsv } from '../lib/csv';
import { formatDay } from '../lib/dates';
import { boundsFromMeta, effectiveDay } from '../lib/urlState';
import { BuyingGuidePanel } from './BuyingGuide';
import { Controls } from './Controls';
import { DailyTable } from './DailyTable';
import { ErrorDistribution } from './ErrorDistribution';
import { HorizonCurve } from './HorizonCurve';
import { HourOfDayChart } from './HourOfDayChart';
import { KpiCards, KpiSkeleton } from './KpiCards';
import { Panel } from './Panel';
import { SeriesChart } from './SeriesChart';
import { EmptyState, ErrorState, Skeleton } from './States';

export function Dashboard() {
  const meta = useMeta();
  const bounds = boundsFromMeta(meta.data);
  const [state, setState] = useUrlState(bounds);
  const ready = !meta.isPending; // wait for real bounds so we do not fetch twice

  const params: AnalysisParams = useMemo(
    () => ({ start: state.start, end: state.end, mode: state.mode, cutoff: state.cutoff, horizon: state.horizon }),
    [state.start, state.end, state.mode, state.cutoff, state.horizon],
  );
  const analysis = useAnalysis(params, ready);
  const curve = useHorizonCurve(state.start, state.end, ready);

  const a = analysis.data;
  const busy = analysis.isFetching && analysis.isPlaceholderData;
  const empty = !!a && (a.metrics.count === 0 || a.series.length === 0);
  const day = effectiveDay(state);

  const typicalHorizon = useMemo(() => (a ? medianHorizon(a.series) : null), [a]);
  const marker = state.mode === 'horizon' ? state.horizon : typicalHorizon;
  const markerLabel = state.mode === 'horizon' ? 'Your setting' : 'Your deadline (typical)';

  const onDownload = useCallback(() => {
    if (a) downloadText(csvFileName(a.params), seriesToCsv(a.series));
  }, [a]);
  const onSelectDay = useCallback(
    (d: string) => {
      setState({ day: d });
      document.getElementById('buying-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [setState],
  );
  const onGuideChange = useCallback((patch: Parameters<typeof setState>[0]) => setState(patch), [setState]);

  const ruleText =
    state.mode === 'deadline'
      ? `Latest forecast published by ${state.cutoff} UK the day before`
      : `Latest forecast published at least ${state.horizon} h ahead`;
  const rangeText = `${formatDay(state.start)} to ${formatDay(state.end)}`;

  const analysisBody = (render: () => JSX.Element, height = 280) =>
    analysis.isPending || !ready ? (
      <Skeleton height={height} />
    ) : analysis.isError && !a ? (
      <ErrorState error={analysis.error} onRetry={() => void analysis.refetch()} />
    ) : empty ? (
      <EmptyState title="No matching hours" text="No forecast and actual pairs exist for these settings. Try a wider date range or a different rule." />
    ) : (
      render()
    );

  return (
    <main id="main" className="dashboard">
      {meta.isError && (
        <div className="banner" role="alert">
          Could not load dataset details; using the standard date range.{' '}
          <button type="button" className="link-btn" onClick={() => void meta.refetch()}>
            Try again
          </button>
        </div>
      )}

      <Controls state={state} bounds={bounds} setState={setState} />

      <p className="context" aria-live="polite">
        <strong>{ruleText}</strong> · {rangeText}
        {busy && <span className="updating"> · Updating…</span>}
        {analysis.isError && a && (
          <span className="updating updating--error">
            {' '}
            · Update failed.{' '}
            <button type="button" className="link-btn" onClick={() => void analysis.refetch()}>
              Retry
            </button>
          </span>
        )}
      </p>

      <section aria-label="Key numbers" className={busy ? 'is-busy' : undefined}>
        {analysis.isPending || !ready ? (
          <KpiSkeleton />
        ) : a && !empty ? (
          <KpiCards metrics={a.metrics} />
        ) : null}
      </section>

      <div className="grid">
        <Panel
          id="series"
          title="Actual vs forecast"
          subtitle="Hourly national wind output. Gaps mean data was missing. Drag the handles below the chart to zoom."
          busy={busy}
          className="panel--wide"
          actions={
            <button type="button" className="btn" onClick={onDownload} disabled={!a || empty}>
              Download CSV
            </button>
          }
        >
          {analysisBody(() => <SeriesChart series={a!.series} />, 360)}
        </Panel>

        <Panel
          id="dist"
          title="How big are the misses?"
          subtitle="Spread of hourly errors (forecast − actual)."
          info="P10, P50 and P90 are the errors that 10%, 50% and 90% of hours fall below. P90 is a sensible starting point for a safety margin."
          busy={busy}
        >
          {analysisBody(() => <ErrorDistribution histogram={a!.histogram} metrics={a!.metrics} />)}
        </Panel>

        <Panel
          id="hour"
          title="Error by hour of day"
          subtitle="Average error and bias for each UK clock hour."
          info="Bias above zero means forecasts for that hour are usually too high."
          busy={busy}
        >
          {analysisBody(() => <HourOfDayChart rows={a!.by_hour} />)}
        </Panel>

        <Panel
          id="horizon"
          title="Accuracy vs how far ahead"
          subtitle="How fast accuracy drops the further ahead you look."
          info="Each point uses the latest forecast published at least that many hours before the target hour, over the selected days."
          busy={curve.isFetching && curve.isPlaceholderData}
        >
          {curve.isPending || !ready ? (
            <Skeleton />
          ) : curve.isError && !curve.data ? (
            <ErrorState error={curve.error} onRetry={() => void curve.refetch()} />
          ) : !curve.data?.length ? (
            <EmptyState title="No data for this range" />
          ) : (
            <HorizonCurve points={curve.data} marker={marker} markerLabel={markerLabel} />
          )}
        </Panel>

        <Panel
          id="daily"
          title="Day by day"
          subtitle="Select a day to open it in the buying guide. Click a column to sort."
          busy={busy}
        >
          {analysisBody(() => <DailyTable rows={a!.daily} selectedDay={day} onSelectDay={onSelectDay} />)}
        </Panel>

        {ready && (
          <BuyingGuidePanel
            start={state.start}
            end={state.end}
            day={day}
            cutoff={state.cutoff}
            confidence={state.confidence}
            modeIsHorizon={state.mode === 'horizon'}
            onChange={onGuideChange}
          />
        )}
      </div>
    </main>
  );
}
