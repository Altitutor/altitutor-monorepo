import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUnknownNumberLinking } from '../useUnknownNumberLinking';
import { linkEmailContact } from '../../api/contacts';

const mockToast = jest.fn();
const mockUpdateStudent = jest.fn();
const mockUpdateParent = jest.fn();
const mockUpdateStaff = jest.fn();
jest.mock('@altitutor/ui', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../../api/contacts', () => ({ linkEmailContact: jest.fn() }));
jest.mock('@/features/students/components/AddStudentModal', () => ({ AddStudentModal: () => null }));
jest.mock('@/features/parents/components/AddParentModal', () => ({ AddParentModal: () => null }));
jest.mock('@/features/staff/components/AddStaffModal', () => ({ AddStaffModal: () => null }));
jest.mock('@/features/students/api/students', () => ({ studentsApi: {
  getAllStudents: async () => [{ id: 'with-phone', first_name: 'Student', phone: '+61412345678' }, { id: 'without-phone', first_name: 'Student', phone: null }],
} }));
jest.mock('@/features/students/hooks/useStudentsQuery', () => ({
  studentsKeys: { lists: () => ['students', 'lists'] },
  useUpdateStudent: () => ({ mutateAsync: mockUpdateStudent }),
}));
jest.mock('@/features/parents/hooks/useParentsQuery', () => ({ useUpdateParent: () => ({ mutateAsync: mockUpdateParent }) }));
jest.mock('@/features/staff/api/staff', () => ({ staffApi: { getAllStaff: async () => [] } }));
jest.mock('@/features/staff/hooks/useStaffQuery', () => ({
  staffKeys: { lists: () => ['staff', 'lists'] },
  useUpdateStaff: () => ({ mutateAsync: mockUpdateStaff }),
}));
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  from: () => ({ select: () => ({ order: async () => ({ data: [{ id: 'parent-with-phone', first_name: 'Parent', phone: '+61487654321' }], error: null }) }) }),
}) }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

it('shows linking for email-only contacts and includes people who already have phones', async () => {
  const { result } = renderHook(() => useUnknownNumberLinking({ contactId: 'unknown', contact: { email: 'apple@example.test' } }), { wrapper });
  expect(result.current.showUnknownNumberActions).toBe(true);
  await waitFor(() => expect(result.current.studentOptionsWithoutPhone).toHaveLength(2));
  expect(result.current.parentOptionsWithoutPhone).toHaveLength(1);
});

it('links an Apple ID and switches to the canonical phone contact without updating the profile', async () => {
  jest.mocked(linkEmailContact).mockResolvedValue('canonical');
  const onLinked = jest.fn();
  const { result } = renderHook(() => useUnknownNumberLinking({ contactId: 'unknown', contact: { email: 'apple@example.test' }, onLinked }), { wrapper });
  await act(() => result.current.onAssignStudent('with-phone'));
  expect(linkEmailContact).toHaveBeenCalledWith('unknown', 'student', 'with-phone');
  expect(onLinked).toHaveBeenCalledWith('canonical');
  expect(mockUpdateStudent).not.toHaveBeenCalled();
  expect(mockUpdateParent).not.toHaveBeenCalled();
  expect(mockUpdateStaff).not.toHaveBeenCalled();
});

it('keeps the unknown thread selected when linking fails', async () => {
  jest.mocked(linkEmailContact).mockRejectedValue(new Error('This person already has a different Apple ID email'));
  const onLinked = jest.fn();
  const { result } = renderHook(() => useUnknownNumberLinking({ contactId: 'unknown', contact: { email: 'apple@example.test' }, onLinked }), { wrapper });
  await act(() => result.current.onAssignParent('parent-with-phone'));
  expect(onLinked).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
});

it('keeps phone assignment restricted to people without a saved phone', async () => {
  const { result } = renderHook(() => useUnknownNumberLinking({ contactId: 'unknown', contact: { phone_e164: '+61400999999' } }), { wrapper });
  await waitFor(() => expect(result.current.studentOptionsWithoutPhone).toHaveLength(1));
  expect(result.current.studentOptionsWithoutPhone[0].id).toBe('without-phone');
  expect(result.current.parentOptionsWithoutPhone).toHaveLength(0);
});

it('hides linking for an already assigned email contact', () => {
  const { result } = renderHook(() => useUnknownNumberLinking({ contactId: 'known', contact: { email: 'apple@example.test', parents: { id: 'parent' } } }), { wrapper });
  expect(result.current.showUnknownNumberActions).toBe(false);
});
