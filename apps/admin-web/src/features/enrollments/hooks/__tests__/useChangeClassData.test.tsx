import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useChangeClassData } from '../useChangeClassData';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

it('preserves the selected class name, timezone, and actual schedule bounds for every transfer step', async () => {
  const classData = {
    id: 'saturday-class', subject_id: 'subject', status: 'ACTIVE',
    long_name: 'English Saturday 1 pm', short_name: 'ENGL Sat',
    schedule_timezone: 'Australia/Perth', schedule_weekdays: [6],
    session_start_date: '2026-09-23', session_end_date: '2026-10-10',
  };
  const rpc = jest.fn().mockResolvedValue({ data: {
    classes: [classData], classSubjects: {}, classStudents: {}, classStaff: {}, total: 1,
  }, error: null });
  jest.mocked(getSupabaseClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseClient>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useChangeClassData({
    isOpen: true, step: 1, oldClassSubjectId: 'subject', searchQuery: '',
  }), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  await waitFor(() => expect(result.current.classes).toHaveLength(1));
  expect(result.current.classes[0]).toMatchObject(classData);
});
