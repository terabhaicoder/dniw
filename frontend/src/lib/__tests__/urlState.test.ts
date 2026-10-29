import { describe, expect, it } from 'vitest';
import { CUTOFF_OPTIONS, DEFAULT_STATE, effectiveDay, parseState, serializeState } from '../urlState';

const bounds = { min: '2026-01-02', max: '2026-02-01', maxHorizon: 48 };

describe('parseState', () => {
  it('returns defaults for an empty query', () => {
    expect(parseState('', bounds)).toEqual(DEFAULT_STATE);
  });

  it('reads every valid field', () => {
    const s = parseState('?start=2026-01-05&end=2026-01-10&mode=horizon&cutoff=07:30&horizon=6&day=2026-01-07&conf=80', bounds);
    expect(s).toEqual({
      start: '2026-01-05',
      end: '2026-01-10',
      mode: 'horizon',
      cutoff: '07:30',
      horizon: 6,
      day: '2026-01-07',
      confidence: 80,
    });
  });

  it.each([
    ['mode=weekly', 'mode', 'deadline'],
    ['cutoff=25:00', 'cutoff', '09:00'],
    ['cutoff=09:15', 'cutoff', '09:00'], // not on the 30-min grid
    ['cutoff=13:00', 'cutoff', '09:00'], // outside 06:00–12:00
    ['horizon=-1', 'horizon', 24],
    ['horizon=49', 'horizon', 24],
    ['horizon=12.5', 'horizon', 24],
    ['horizon=abc', 'horizon', 24],
    ['conf=85', 'confidence', 90],
    ['conf=', 'confidence', 90],
    ['start=2026-02-30', 'start', '2026-01-02'], // impossible date
    ['start=yesterday', 'start', '2026-01-02'],
    ['day=2025-12-01', 'day', ''], // outside range
  ])('invalid %s falls back to the default', (qs, key, expected) => {
    expect(parseState(`?${qs}`, bounds)[key as keyof typeof DEFAULT_STATE]).toEqual(expected);
  });

  it('keeps good fields when others are bad', () => {
    const s = parseState('?mode=nope&cutoff=10:30&horizon=999', bounds);
    expect(s.mode).toBe('deadline');
    expect(s.cutoff).toBe('10:30');
    expect(s.horizon).toBe(24);
  });

  it('clamps dates to the dataset range and swaps reversed ranges', () => {
    expect(parseState('?start=2025-06-01&end=2027-01-01', bounds)).toMatchObject({ start: '2026-01-02', end: '2026-02-01' });
    expect(parseState('?start=2026-01-20&end=2026-01-10', bounds)).toMatchObject({ start: '2026-01-10', end: '2026-01-20' });
  });

  it('respects a smaller max horizon from meta', () => {
    expect(parseState('?horizon=30', { ...bounds, maxHorizon: 24 }).horizon).toBe(24);
    expect(parseState('?horizon=12', { ...bounds, maxHorizon: 24 }).horizon).toBe(12);
  });
});

describe('serializeState', () => {
  it('omits defaults so the link stays short', () => {
    expect(serializeState(DEFAULT_STATE, bounds)).toBe('');
  });

  it('round-trips through parseState', () => {
    const s = { ...DEFAULT_STATE, start: '2026-01-10', mode: 'horizon' as const, horizon: 36, confidence: 95 as const, day: '2026-01-15' };
    const qs = serializeState(s, bounds);
    expect(qs).toBe('?start=2026-01-10&mode=horizon&horizon=36&day=2026-01-15&conf=95');
    expect(parseState(qs, bounds)).toEqual(s);
  });
});

describe('helpers', () => {
  it('offers cut-offs 06:00 to 12:00 every 30 minutes', () => {
    expect(CUTOFF_OPTIONS[0]).toBe('06:00');
    expect(CUTOFF_OPTIONS.at(-1)).toBe('12:00');
    expect(CUTOFF_OPTIONS).toHaveLength(13);
    expect(CUTOFF_OPTIONS).toContain('09:00');
  });

  it('buying-guide day defaults to the last day in range', () => {
    expect(effectiveDay({ ...DEFAULT_STATE, end: '2026-01-20' })).toBe('2026-01-20');
    expect(effectiveDay({ ...DEFAULT_STATE, day: '2026-01-05' })).toBe('2026-01-05');
  });
});
