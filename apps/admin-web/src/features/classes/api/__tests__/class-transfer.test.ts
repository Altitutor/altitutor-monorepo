import { classesApi } from '../classes';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/shared/utils/plainTextToTiptapJson', () => ({ isTiptapContentEmpty: () => true }));

it('sends independent calendar dates to one atomic transfer command', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
  jest.mocked(getSupabaseClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseClient>);
  await classesApi.changeClass({ studentId: 'student', oldClassId: 'old', newClassId: 'new', lastOldClassDate: '2026-09-09', firstNewClassDate: '2026-09-19', staffId: 'staff' });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('change_student_class', {
    p_student_id: 'student', p_old_class_id: 'old', p_new_class_id: 'new',
    p_last_old_date: '2026-09-09', p_first_new_date: '2026-09-19', p_staff_id: 'staff',
  });
});

it('uses the enrolment command to correct a scheduled end without filtering it out', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
  jest.mocked(getSupabaseClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseClient>);
  await classesApi.unenrollStudentWithReason({ studentId: 'student', classId: 'old', unenrolledAt: new Date('2026-09-09T14:30:00Z'), reason: {}, staffId: 'staff' });
  expect(rpc).toHaveBeenCalledWith('end_student_class_enrolment', {
    p_student_id: 'student', p_class_id: 'old', p_unenrolled_at: '2026-09-09T14:30:00.000Z', p_staff_id: 'staff', p_reason: undefined,
  });
});
