import { bookingsApi } from '../bookings';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/features/students/api/linkStudentParents', () => ({
  linkStudentParents: jest.fn(),
}));

function mockAuthenticatedClient(rpc: jest.Mock) {
  jest.mocked(getSupabaseClient).mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    rpc,
  } as unknown as ReturnType<typeof getSupabaseClient>);
}

describe('bookingsApi', () => {
  it('rejects a Drafting booking without a Subject before calling Supabase', async () => {
    await expect(bookingsApi.createBooking({
      session_type: 'DRAFTING',
      student_id: 'student-1',
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-01T01:00:00.000Z',
    })).rejects.toThrow('A subject is required for drafting sessions');
  });

  it.each([
    ['', null],
    ['   ', null],
    ['+61', null],
    ['+61412345678', '+61412345678'],
    ['0412345678', '0412345678'],
  ] as const)('stores trial student phone %j as %j', async (studentPhone, storedPhone) => {
    const rpc = jest.fn().mockResolvedValue({
      data: { session_id: 'session-1' },
      error: null,
    });
    mockAuthenticatedClient(rpc);

    await bookingsApi.createBooking({
      session_type: 'TRIAL_SESSION',
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-01T01:00:00.000Z',
      trial_student_data: {
        student_first_name: 'Ada',
        student_last_name: 'Lovelace',
        student_phone: studentPhone,
      },
    });

    expect(rpc).toHaveBeenCalledWith('create_admin_trial_booking', expect.objectContaining({
      p_student_phone: storedPhone,
      p_student_first_name: 'Ada',
    }));
  });

  it.each([
    [
      'another student',
      'This phone number is already linked to another student. Use a different number, or check the other student\'s contact details.',
    ],
    [
      'a parent',
      'This phone number is already linked to a parent. Use a different number for the student, or check the parent\'s contact details.',
    ],
    [
      'a student',
      'This phone number is already linked to a student. Use a different number for the parent, or check the student contact details.',
    ],
  ])('explains a trial booking phone conflict with %s without exposing record identifiers', async (owner, explanation) => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: `Phone number +61400000000 is already associated with ${owner} (ID: 00000000-0000-0000-0000-000000000001)`,
      },
    });
    mockAuthenticatedClient(rpc);

    await expect(bookingsApi.createBooking({
      session_type: 'TRIAL_SESSION',
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-01T01:00:00.000Z',
      trial_student_data: { student_first_name: 'Ada', student_phone: '+61400000000' },
    })).rejects.toMatchObject({ message: explanation });
  });

  it('keeps other trial booking failures visible', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Active AdminStaff access required' },
    });
    mockAuthenticatedClient(rpc);

    await expect(bookingsApi.createBooking({
      session_type: 'TRIAL_SESSION',
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-01T01:00:00.000Z',
      trial_student_data: { student_first_name: 'Ada' },
    })).rejects.toMatchObject({ message: 'Active AdminStaff access required' });
  });
});
