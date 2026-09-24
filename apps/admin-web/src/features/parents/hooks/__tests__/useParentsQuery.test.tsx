import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useParentsList } from '../useParentsQuery';
import { parentsApi } from '../../api/parents';

jest.mock('../../api/parents', () => ({
  parentsApi: {
    list: jest.fn(),
  },
}));

const mockParentsApi = parentsApi as jest.Mocked<typeof parentsApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('useParentsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParentsApi.list.mockResolvedValue({ parents: [], total: 0 });
  });

  it('forwards name, email and phone search fields to the parents list API', async () => {
    renderHook(
      () =>
        useParentsList({
          search: 'robert.williams@parent.test',
          searchFields: ['email'],
          page: 1,
          pageSize: 50,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockParentsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'robert.williams@parent.test',
          searchFields: ['email'],
        }),
      );
    });
  });
});
