import { useTheme } from '../hooks/useTheme';

export function Header() {
  const { theme, toggle } = useTheme();
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <svg className="app-header__logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" />
          <path d="M6 12h14a4 4 0 1 0-4-4M6 17h19a4 4 0 1 1-4 4M6 22h9" />
        </svg>
        <div>
          <h1 className="app-header__title">WindCast</h1>
          <p className="app-header__subtitle">Day-ahead wind forecast monitor — GB national wind</p>
        </div>
      </div>
      <button
        type="button"
        className="btn btn--ghost theme-toggle"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        <span className="theme-toggle__text">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </header>
  );
}
