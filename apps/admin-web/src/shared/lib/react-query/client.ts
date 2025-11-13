import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default - reduce refetch frequency
      staleTime: 1000 * 60 * 5,
      // Keep data in cache for 10 minutes after component unmounts
      gcTime: 1000 * 60 * 10,
      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry cancelled queries
        if (error?.message === 'Query cancelled' || error?.name === 'AbortError') {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Only refetch if stale when component mounts
      refetchOnMount: true,
      // Disable refetch on window focus to reduce excessive requests during testing
      refetchOnWindowFocus: false,
      // Refetch after network reconnection
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
}); 