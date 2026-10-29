/** Types mirroring docs/API.md exactly. All power values are MW, all times ISO-8601 UTC. */

export type Mode = 'deadline' | 'horizon';
export type Confidence = 50 | 80 | 90 | 95;

export interface Meta {
  delivery_start: string;
  delivery_end: string;
  default_cutoff: string;
  max_horizon: number;
  forecast_versions: number;
  actual_points: number;
  source: string;
  data_note: string;
}

export interface AnalysisParams {
  start: string;
  end: string;
  mode: Mode;
  cutoff: string;
  horizon: number;
}

export interface SeriesPoint {
  time: string;
  actual: number | null;
  forecast: number | null;
  publish_time: string | null;
  horizon_h: number | null;
  error: number | null;
}

export interface Metrics {
  count: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  nmae_pct: number | null;
  mean_actual: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  max_over: number | null;
  max_under: number | null;
  coverage_pct: number | null;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface HourStat {
  hour: number;
  mae: number | null;
  bias: number | null;
  count: number;
}

export interface DailyStat {
  date: string;
  mae: number | null;
  bias: number | null;
  actual_mean: number | null;
  forecast_mean: number | null;
  count: number;
}

export interface Analysis {
  params: AnalysisParams;
  series: SeriesPoint[];
  metrics: Metrics;
  histogram: HistogramBin[];
  by_hour: HourStat[];
  daily: DailyStat[];
}

export interface HorizonPoint {
  horizon_h: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  count: number;
}

export interface BuyingHour {
  time: string;
  forecast: number | null;
  safe_wind: number | null;
  actual: number | null;
  publish_time: string | null;
}

export interface BuyingGuide {
  date: string;
  cutoff: string;
  confidence: Confidence;
  margin_mw: number | null;
  hours: BuyingHour[];
  totals: { forecast_mwh: number | null; safe_mwh: number | null; actual_mwh: number | null };
}
