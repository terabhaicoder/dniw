/** Date helpers. Delivery days are UK local dates (YYYY-MM-DD); timestamps are UTC ISO strings. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const UK_TZ = 'Europe/London';

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of dates between a and b (YYYY-MM-DD). */
export function dateRange(a: string, b: string): string[] {
  const out: string[] = [];
  for (let d = a; d <= b && out.length < 1000; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysBetweenInclusive(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
}

export function clampDate(d: string, min: string, max: string): string {
  return d < min ? min : d > max ? max : d;
}

const ukDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const ukShort = new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, day: 'numeric', month: 'short' });
const ukTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const plainDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "2 Jan, 09:00" in UK time. */
export function formatUkDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '—' : ukDateTime.format(t);
}

export function formatUkShortDate(iso: string | number): string {
  return ukShort.format(typeof iso === 'number' ? iso : Date.parse(iso));
}

export function formatUkTime(iso: string | number): string {
  return ukTime.format(typeof iso === 'number' ? iso : Date.parse(iso));
}

/** "Fri 2 Jan 2026" for a YYYY-MM-DD delivery day. */
export function formatDay(date: string): string {
  return isIsoDate(date) ? plainDay.format(Date.parse(`${date}T00:00:00Z`)) : date;
}
