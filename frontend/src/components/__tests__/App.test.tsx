import { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { mockFetch } from '../../api/mock';

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** fetch stub backed by the contract-shaped mock; `fail` lets a test break one endpoint. */
function stubFetch(fail?: (path: string) => Response | null) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const override = fail?.(url.pathname);
    if (override) return override;
    return json(mockFetch(url.pathname, Object.fromEntries(url.searchParams)));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('App', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('shows loading skeletons, then real numbers', async () => {
    const fetchMock = stubFetch();
    render(<App client={client()} />);

    expect(screen.getByRole('heading', { name: 'WindCast' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0); // skeletons

    const kpis = await screen.findByRole('list', { name: 'Key accuracy numbers' });
    expect(within(kpis).getByText('Average error (MAE)')).toBeInTheDocument();
    expect(within(kpis).getAllByText(/GW$/).length).toBeGreaterThan(0);
    expect(await screen.findByText('Wind to rely on')).toBeInTheDocument();
    expect(screen.getByText('Buy the rest of your demand from the day-ahead market.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Choose a delivery day' })).toBeInTheDocument();
    expect(screen.getByText(/9 in 10 hours, the forecast was no more than/)).toBeInTheDocument();

    const analysisCall = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/api/analysis'));
    expect(analysisCall).toContain('mode=deadline');
    expect(analysisCall).toContain('cutoff=09%3A00');
    expect(analysisCall).not.toContain('horizon=');
    expect(screen.getByText('Data: Elexon BMRS (FUELHH, WINDFOR). Pilot build.')).toBeInTheDocument();
  });

  it('switching mode updates the URL and refetches with the horizon', async () => {
    const fetchMock = stubFetch();
    render(<App client={client()} />);
    await screen.findByRole('list', { name: 'Key accuracy numbers' });

    await userEvent.click(screen.getByRole('radio', { name: 'Forecast horizon' }));
    expect(window.location.search).toBe('?mode=horizon');
    expect(screen.getByRole('slider', { name: /Look-ahead/ })).toHaveValue('24');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => /mode=horizon&horizon=24/.test(String(c[0])))).toBe(true),
    );
  });

  it('shows an error with a working retry', async () => {
    let broken = true;
    stubFetch((path) => (path === '/api/analysis' && broken ? json({ detail: 'boom' }, 500) : null));
    render(<App client={client()} />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('Server error (500)');

    broken = false;
    await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);
    expect(await screen.findByRole('list', { name: 'Key accuracy numbers' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Server error/)).not.toBeInTheDocument());
  });

  it('turns a 422 into a readable message', async () => {
    stubFetch((path) =>
      path === '/api/analysis' ? json({ detail: [{ loc: ['query', 'cutoff'], msg: 'bad cutoff', type: 'value_error' }] }, 422) : null,
    );
    render(<App client={client()} />);
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Some settings were not accepted: bad cutoff');
  });

  it('shows an empty state when no hours match', async () => {
    stubFetch((path) => {
      if (path !== '/api/analysis') return null;
      const a = mockFetch('/api/analysis', {}) as ReturnType<typeof import('../../api/mock').mockAnalysis>;
      return json({ ...a, series: [], histogram: [], by_hour: [], daily: [], metrics: { ...a.metrics, count: 0 } });
    });
    render(<App client={client()} />);
    expect((await screen.findAllByText('No matching hours')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  });
});
