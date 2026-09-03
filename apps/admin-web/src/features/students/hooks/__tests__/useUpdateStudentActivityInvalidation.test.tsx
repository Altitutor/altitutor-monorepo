import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { studentsApi } from '../../api/students';
import { useUpdateStudent } from '../useStudentsQuery';

jest.mock('../../api/students', () => ({
  studentsApi: { updateStudent: jest.fn() },
}));

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidateQueries, wrapper };
}

describe('useUpdateStudent activity invalidation', () => {
  it('refreshes student activity after details are persisted', async () => {
    jest.mocked(studentsApi.updateStudent).mockResolvedValue({ id: 'student-1' } as Awaited<
      ReturnType<typeof studentsApi.updateStudent>
    >);
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdateStudent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'student-1',
        data: { birthday: '2000-01-03' },
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'student', 'student-1'],
    });
  });
});
