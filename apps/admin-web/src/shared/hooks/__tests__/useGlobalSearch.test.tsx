/**
 * Tests for useGlobalSearch hook
 * Tests global search functionality with React Query
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGlobalSearch, flattenGlobalSearchResults } from '../useGlobalSearch';
import { searchApi } from '@/shared/api/search';
import type { GlobalSearchResponse } from '@/shared/api/search';

// Mock search API
jest.mock('@/shared/api/search', () => ({
  searchApi: {
    global: jest.fn(),
  },
}));

const mockSearchApi = searchApi as jest.Mocked<typeof searchApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('useGlobalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch search results when search term is provided', async () => {
    const mockResponse: GlobalSearchResponse = {
      results: [
        {
          type: 'student',
          id: 'student-1',
          score: 100,
          match_type: 'primary',
          data: {
            id: 'student-1',
            first_name: 'John',
            last_name: 'Doe',
            status: 'ACTIVE',
            curriculum: 'SACE',
            year_level: 10,
            school: null,
            classes: [],
          },
        },
      ],
      total: 1,
      has_more: false,
    };

    mockSearchApi.global.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'John', limit: 10 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages[0]).toEqual(mockResponse);
    expect(mockSearchApi.global).toHaveBeenCalledWith({
      search: 'John',
      limit: 10,
      offset: 0,
      weights: undefined,
    });
  });

  it('should not fetch when search term is less than 2 characters', () => {
    mockSearchApi.global.mockResolvedValue({
      results: [],
      total: 0,
      has_more: false,
    });

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'J', limit: 10 }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockSearchApi.global).not.toHaveBeenCalled();
  });

  it('should trim search term', async () => {
    const mockResponse: GlobalSearchResponse = {
      results: [],
      total: 0,
      has_more: false,
    };

    mockSearchApi.global.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useGlobalSearch({ search: '  John  ', limit: 10 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearchApi.global).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'John',
      })
    );
  });

  it('should pass weights to API', async () => {
    const mockResponse: GlobalSearchResponse = {
      results: [],
      total: 0,
      has_more: false,
    };

    mockSearchApi.global.mockResolvedValue(mockResponse);

    const weights = { primary: 150, secondary: 75 };

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'test', limit: 10, weights }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearchApi.global).toHaveBeenCalledWith({
      search: 'test',
      limit: 10,
      offset: 0,
      weights,
    });
  });

  it('should handle pagination with getNextPageParam', async () => {
    const page1: GlobalSearchResponse = {
      results: [{ type: 'student', id: '1', score: 100, match_type: 'primary', data: { id: '1', first_name: 'John', last_name: 'Doe', status: 'ACTIVE', curriculum: null, year_level: null, school: null, classes: [] } }],
      total: 2,
      has_more: true,
    };

    const page2: GlobalSearchResponse = {
      results: [{ type: 'student', id: '2', score: 90, match_type: 'primary', data: { id: '2', first_name: 'Jane', last_name: 'Smith', status: 'ACTIVE', curriculum: null, year_level: null, school: null, classes: [] } }],
      total: 2,
      has_more: false,
    };

    mockSearchApi.global
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'test', limit: 1 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);

    // Fetch next page
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1]).toEqual(page2);
  });

  it('should use default limit of 10', async () => {
    const mockResponse: GlobalSearchResponse = {
      results: [],
      total: 0,
      has_more: false,
    };

    mockSearchApi.global.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'test' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSearchApi.global).toHaveBeenCalledWith({
      search: 'test',
      limit: 10,
      offset: 0,
      weights: undefined,
    });
  });

  it('should handle errors', async () => {
    const error = new Error('Search failed');
    mockSearchApi.global.mockRejectedValue(error);

    const { result } = renderHook(
      () => useGlobalSearch({ search: 'test' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
  });
});

describe('flattenGlobalSearchResults', () => {
  it('should flatten pages into single array', () => {
    const data = {
      pages: [
        {
          results: [
            { type: 'student' as const, id: '1', score: 100, match_type: 'primary' as const, data: { id: '1', first_name: 'John', last_name: 'Doe', status: 'ACTIVE', curriculum: null, year_level: null, school: null, classes: [] } },
          { type: 'student' as const, id: '2', score: 90, match_type: 'primary' as const, data: { id: '2', first_name: 'Jane', last_name: 'Smith', status: 'ACTIVE', curriculum: null, year_level: null, school: null, classes: [] } },
          ],
          total: 2,
          has_more: true,
        },
        {
          results: [
            { type: 'student' as const, id: '3', score: 80, match_type: 'primary' as const, data: { id: '3', first_name: 'Bob', last_name: 'Jones', status: 'ACTIVE', curriculum: null, year_level: null, school: null, classes: [] } },
          ],
          total: 2,
          has_more: false,
        },
      ],
      pageParams: [0, 1],
    };

    const flattened = flattenGlobalSearchResults(data);

    expect(flattened).toHaveLength(3);
    expect(flattened[0].id).toBe('1');
    expect(flattened[1].id).toBe('2');
    expect(flattened[2].id).toBe('3');
  });

  it('should return empty array when data is undefined', () => {
    const flattened = flattenGlobalSearchResults(undefined);
    expect(flattened).toEqual([]);
  });

  it('should return empty array when pages are empty', () => {
    const data = {
      pages: [],
      pageParams: [],
    };

    const flattened = flattenGlobalSearchResults(data);
    expect(flattened).toEqual([]);
  });
});
