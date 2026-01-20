/**
 * Shared test utilities for React Testing Library
 * Provides common wrappers and helpers for testing
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { renderHook, type RenderHookOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock ToastProvider component for tests
// This provides a context that matches what useToast expects
const MockToastProvider = ({ children }: { children: React.ReactNode }) => {
  // Try to use the real ToastProvider if available, otherwise use mock
  try {
    // Dynamic import would be async, so we use require for synchronous check
    // This is acceptable in test utilities where we need to conditionally load modules
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const uiModule = require('@altitutor/ui');
    const RealToastProvider = uiModule.ToastProvider;
    if (RealToastProvider && typeof RealToastProvider === 'function') {
      return <RealToastProvider>{children}</RealToastProvider>;
    }
  } catch {
    // Fall through to mock
  }

  // Use a simple wrapper that provides the context
  // Note: This won't work if useToast is checking for a specific context
  // In that case, tests should mock useToast directly
  return <>{children}</>;
};
MockToastProvider.displayName = 'MockToastProvider';

/**
 * Creates a QueryClient wrapper for React Query hooks
 */
export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const QueryClientWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  QueryClientWrapper.displayName = 'QueryClientWrapper';

  return QueryClientWrapper;
}

/**
 * Creates a wrapper with QueryClient and ToastProvider
 * Use this for components that use useToast hook
 */
export function createAllProvidersWrapper() {
  const QueryWrapper = createQueryClientWrapper();

  const AllProvidersWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryWrapper>
      <MockToastProvider>{children}</MockToastProvider>
    </QueryWrapper>
  );
  AllProvidersWrapper.displayName = 'AllProvidersWrapper';

  return AllProvidersWrapper;
}

/**
 * Custom render function that includes all providers
 * Use this instead of the default render from @testing-library/react
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = createAllProvidersWrapper();
  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Custom renderHook function that includes all providers
 * Use this instead of the default renderHook from @testing-library/react
 */
export function renderHookWithProviders<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>
) {
  const Wrapper = createAllProvidersWrapper();
  return renderHook(hook, { wrapper: Wrapper, ...options });
}

/**
 * Custom renderHook function that includes only QueryClient
 * Use this for hooks that don't need ToastProvider
 */
export function renderHookWithQueryClient<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>
) {
  const Wrapper = createQueryClientWrapper();
  return renderHook(hook, { wrapper: Wrapper, ...options });
}
