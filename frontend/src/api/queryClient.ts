import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Do not retry invalid input (4xx); retry network/server errors twice.
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
    },
  });
}
