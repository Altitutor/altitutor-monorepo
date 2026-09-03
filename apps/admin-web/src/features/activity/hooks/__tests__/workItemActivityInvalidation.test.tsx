import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateTask } from '@/features/tasks/api/mutations';
import { tasksApi } from '@/features/tasks/api/tasks';
import { useUpdateIssue } from '@/features/issues/api/mutations';
import { issuesApi } from '@/features/issues/api/issues';
import { useUpdateProject } from '@/features/projects/api/mutations';
import { projectsApi } from '@/features/projects/api/projects';

jest.mock('@altitutor/ui', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/features/tasks/api/tasks', () => ({
  tasksApi: { update: jest.fn() },
}));

jest.mock('@/features/issues/api/issues', () => ({
  issuesApi: { update: jest.fn() },
}));

jest.mock('@/features/projects/api/projects', () => ({
  projectsApi: { update: jest.fn() },
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

describe('work-item activity invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes task activity after a task property is persisted', async () => {
    jest.mocked(tasksApi.update).mockResolvedValue({ id: 'task-1' } as Awaited<
      ReturnType<typeof tasksApi.update>
    >);
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'task-1', updates: { priority: 2 } });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'task', 'task-1'],
    });
  });

  it('refreshes issue activity after an issue property is persisted', async () => {
    jest.mocked(issuesApi.update).mockResolvedValue({ id: 'issue-1' } as Awaited<
      ReturnType<typeof issuesApi.update>
    >);
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdateIssue(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'issue-1',
        updates: { due_date: '2026-09-03T00:00:00.000Z' },
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'issue', 'issue-1'],
    });
  });

  it('refreshes project activity after a project property is persisted', async () => {
    jest.mocked(projectsApi.update).mockResolvedValue({ id: 'project-1' } as Awaited<
      ReturnType<typeof projectsApi.update>
    >);
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdateProject(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'project-1', updates: { priority: 2 } });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'project', 'project-1'],
    });
  });
});
