import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HelpPanel } from './components/HelpPanel';
import { ThemeProvider } from './hooks/useTheme';
import { makeQueryClient } from './api/queryClient';

export function App({ client }: { client?: QueryClient }) {
  const [qc] = useState(() => client ?? makeQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="app">
          <Header />
          <HelpPanel />
          <Dashboard />
          <Footer />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
