import { QueryClient } from '@tanstack/react-query';

// Single client for the SPA (module scope survives React Strict Mode remounts in dev).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
