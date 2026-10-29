/** Number formatting. Inputs are MW / MWh (as in the API); display is GW / GWh for consistency. */

/** Shown when a value is missing. */
export const DASH = 'n/a';

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function toGW(mw: number | null | undefined): number | null {
  return isNum(mw) ? mw / 1000 : null;
}

/** 1234.5 MW → "1.23 GW". */
export function formatGW(mw: number | null | undefined, decimals = 2): string {
  return isNum(mw) ? `${(mw / 1000).toFixed(decimals)} GW` : DASH;
}

/** Signed: 120 MW → "+0.12 GW", −402 → "−0.40 GW" (true minus sign). */
export function formatSignedGW(mw: number | null | undefined, decimals = 2): string {
  if (!isNum(mw)) return DASH;
  const v = (mw / 1000).toFixed(decimals);
  if (Number(v) === 0) return `0.${'0'.repeat(decimals)} GW`;
  return mw > 0 ? `+${v} GW` : `−${v.slice(1)} GW`;
}

/** MWh → "309.6 GWh". */
export function formatGWh(mwh: number | null | undefined, decimals = 1): string {
  return isNum(mwh) ? `${(mwh / 1000).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} GWh` : DASH;
}

export function formatPct(v: number | null | undefined, decimals = 1): string {
  return isNum(v) ? `${v.toFixed(decimals)}%` : DASH;
}

/** 16.5 → "16.5 h", 24 → "24 h". */
export function formatHours(h: number | null | undefined): string {
  if (!isNum(h)) return DASH;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

/** Plain words for bias: "Forecasts run 0.12 GW high on average". */
export function describeBias(biasMw: number | null | undefined): string {
  if (!isNum(biasMw)) return 'Not enough data';
  const abs = Math.abs(biasMw);
  if (abs < 50) return 'Forecasts are about right on average';
  return `Forecasts run ${formatGW(abs)} ${biasMw > 0 ? 'high' : 'low'} on average`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-GB');
}
