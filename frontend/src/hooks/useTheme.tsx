import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'windcast-theme';

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Chart colours per theme (SVG attributes cannot rely on CSS variables everywhere). */
export const CHART_COLORS = {
  light: {
    actual: '#1f2937',
    forecast: '#0f766e',
    safe: '#d97706',
    over: '#dc2626',
    under: '#2563eb',
    grid: '#e5e7eb',
    axis: '#4b5563',
    accent: '#7c3aed',
    fill: '#0f766e',
  },
  dark: {
    actual: '#e5e7eb',
    forecast: '#2dd4bf',
    safe: '#fbbf24',
    over: '#f87171',
    under: '#60a5fa',
    grid: '#2b3442',
    axis: '#a3adbb',
    accent: '#c4b5fd',
    fill: '#2dd4bf',
  },
} as const;
export type ChartColors = (typeof CHART_COLORS)[Theme];

interface Ctx {
  theme: Theme;
  toggle: () => void;
  colors: ChartColors;
}
const ThemeContext = createContext<Ctx>({ theme: 'light', toggle: () => {}, colors: CHART_COLORS.light });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const theme = explicit ?? system;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setExplicit(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked (e.g. some private modes) — theme still applies for this visit */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle, colors: CHART_COLORS[theme] }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
