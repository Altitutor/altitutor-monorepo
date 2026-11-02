import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resourcesApi } from '../../api/resources';
import type { ResourceFile } from '../../lib/types';
import { useResourceSignedFileUrl } from '../useResources';

const ONE_HOUR_MS = 60 * 60 * 1000;
const REFRESH_SAFETY_BOUNDARY_MS = 50 * 60 * 1000;

const resourceFile: ResourceFile = {
  id: 'file-1',
  topicId: 'topic-1',
  code: '1.1N.1',
  type: 'NOTES',
  index: 1,
  filename: 'notes.pdf',
  mimetype: 'application/pdf',
  storagePath: 'topic-1/notes.pdf',
  bucket: 'resources',
  externalUrl: null,
  isSolutions: false,
  isSolutionsOfId: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useResourceSignedFileUrl', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('refreshes a mounted resource URL before its one-hour expiry', async () => {
    jest.useFakeTimers();
    const mountedAt = Date.now();
    jest.spyOn(resourcesApi, 'getTopicFileByCode').mockResolvedValue(resourceFile);
    jest
      .spyOn(resourcesApi, 'getSignedFileUrl')
      .mockResolvedValueOnce('https://example.com/first-signed-url')
      .mockResolvedValueOnce('https://example.com/refreshed-signed-url');

    const { result } = renderHook(() => useResourceSignedFileUrl(resourceFile.topicId, resourceFile.code), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe('https://example.com/first-signed-url');
    });

    const elapsedSinceMount = Date.now() - mountedAt;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(REFRESH_SAFETY_BOUNDARY_MS - elapsedSinceMount - 1);
    });
    expect(result.current.data).toBe('https://example.com/first-signed-url');
    expect(resourcesApi.getSignedFileUrl).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    await waitFor(() => {
      expect(result.current.data).toBe('https://example.com/refreshed-signed-url');
      expect(resourcesApi.getSignedFileUrl).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes a stale resource URL when a suspended page becomes visible', async () => {
    jest.useFakeTimers();
    focusManager.setFocused(false);
    jest.spyOn(resourcesApi, 'getTopicFileByCode').mockResolvedValue(resourceFile);
    jest
      .spyOn(resourcesApi, 'getSignedFileUrl')
      .mockResolvedValueOnce('https://example.com/first-signed-url')
      .mockResolvedValueOnce('https://example.com/refreshed-signed-url');

    const { result } = renderHook(() => useResourceSignedFileUrl(resourceFile.topicId, resourceFile.code), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe('https://example.com/first-signed-url');
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(ONE_HOUR_MS);
    });
    expect(result.current.data).toBe('https://example.com/first-signed-url');

    await act(async () => {
      focusManager.setFocused(true);
    });

    await waitFor(() => {
      expect(result.current.data).toBe('https://example.com/refreshed-signed-url');
    });
  });

  it('refreshes a stale cached resource URL when the viewer remounts', async () => {
    jest.useFakeTimers();
    jest.spyOn(resourcesApi, 'getTopicFileByCode').mockResolvedValue(resourceFile);
    jest
      .spyOn(resourcesApi, 'getSignedFileUrl')
      .mockResolvedValueOnce('https://example.com/first-signed-url')
      .mockResolvedValueOnce('https://example.com/refreshed-signed-url');
    const wrapper = createWrapper();

    const firstView = renderHook(() => useResourceSignedFileUrl(resourceFile.topicId, resourceFile.code), { wrapper });
    await waitFor(() => {
      expect(firstView.result.current.data).toBe('https://example.com/first-signed-url');
    });
    firstView.unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(ONE_HOUR_MS);
    });

    const restoredView = renderHook(() => useResourceSignedFileUrl(resourceFile.topicId, resourceFile.code), {
      wrapper,
    });

    await waitFor(() => {
      expect(restoredView.result.current.data).toBe('https://example.com/refreshed-signed-url');
    });
  });
});
