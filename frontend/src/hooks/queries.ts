import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AnalysisParams, Confidence } from '../api/types';

export const queryKeys = {
  meta: ['meta'] as const,
  analysis: (p: AnalysisParams) =>
    ['analysis', p.start, p.end, p.mode, p.mode === 'deadline' ? p.cutoff : p.horizon] as const,
  horizon: (start: string, end: string) => ['horizon-curve', start, end] as const,
  buying: (date: string, cutoff: string, confidence: Confidence) => ['buying-guide', date, cutoff, confidence] as const,
};

// The dataset is a fixed historical window, so responses never go stale during a session.
const STATIC = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

export function useMeta() {
  return useQuery({ queryKey: queryKeys.meta, queryFn: ({ signal }) => api.meta(signal), ...STATIC });
}

export function useAnalysis(p: AnalysisParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysis(p),
    queryFn: ({ signal }) => api.analysis(p, signal),
    // Keep showing the previous result (dimmed) while the next one loads: no layout jump.
    placeholderData: keepPreviousData,
    enabled,
    ...STATIC,
  });
}

export function useHorizonCurve(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.horizon(start, end),
    queryFn: ({ signal }) => api.horizonCurve(start, end, signal),
    placeholderData: keepPreviousData,
    enabled,
    ...STATIC,
  });
}

export function useBuyingGuide(date: string, cutoff: string, confidence: Confidence, enabled = true) {
  return useQuery({
    queryKey: queryKeys.buying(date, cutoff, confidence),
    queryFn: ({ signal }) => api.buyingGuide(date, cutoff, confidence, signal),
    placeholderData: keepPreviousData,
    enabled,
    ...STATIC,
  });
}
