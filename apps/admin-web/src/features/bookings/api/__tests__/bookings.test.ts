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
});
