import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUrlState } from '../useUrlState';

const bounds = { min: '2026-01-02', max: '2026-02-01', maxHorizon: 48 };

describe('useUrlState', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));

  it('reads state from the URL', () => {
    window.history.replaceState(null, '', '/?mode=horizon&horizon=12');
    const { result } = renderHook(() => useUrlState(bounds));
    expect(result.current[0].mode).toBe('horizon');
    expect(result.current[0].horizon).toBe(12);
  });

  it('rewrites invalid URLs into canonical form', () => {
    window.history.replaceState(null, '', '/?mode=bad&cutoff=99:99&conf=80');
    renderHook(() => useUrlState(bounds));
    expect(window.location.search).toBe('?conf=80');
  });

  it('pushes a history entry on change and follows Back', async () => {
    const { result } = renderHook(() => useUrlState(bounds));
    const before = window.history.length;
    act(() => result.current[1]({ cutoff: '10:00' }));
    expect(window.location.search).toBe('?cutoff=10:00');
    expect(result.current[0].cutoff).toBe('10:00');
    expect(window.history.length).toBe(before + 1);

    await act(async () => {
      window.history.back();
      await new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    });
    expect(result.current[0].cutoff).toBe('09:00');
  });

  it('replace option does not add history entries', () => {
    const { result } = renderHook(() => useUrlState(bounds));
    const before = window.history.length;
    act(() => result.current[1]({ horizon: 30 }, { replace: true }));
    expect(window.history.length).toBe(before);
    expect(result.current[0].horizon).toBe(30);
  });

  it('validates patches too (bad values never reach the URL)', () => {
    const { result } = renderHook(() => useUrlState(bounds));
    act(() => result.current[1]({ horizon: 500, day: '1999-01-01' }));
    expect(result.current[0].horizon).toBe(24);
    expect(result.current[0].day).toBe('');
    expect(window.location.search).toBe('');
  });
});
