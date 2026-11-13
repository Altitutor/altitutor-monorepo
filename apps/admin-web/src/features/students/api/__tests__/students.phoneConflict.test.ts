import { studentsApi } from '../students';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const STUDENT_CONFLICT = 'This phone number is already linked to another student. Use a different number, or check the other student\'s contact details.';
const studentPhoneConflict = {
  code: 'P0001',
  message: 'Phone number +61400000000 is already associated with another student (ID: 00000000-0000-0000-0000-000000000001)',
};

describe('student phone conflicts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('explains a duplicate phone on Student creation without exposing record identifiers', async () => {
    const query = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: studentPhoneConflict }),
    };
    jest.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(studentsApi.createStudent({ id: 'student-1', first_name: 'Ada', last_name: 'Lovelace', phone: '+61400000000' }))
      .rejects.toMatchObject({ message: STUDENT_CONFLICT });
  });

  it('keeps other Student creation failures visible', async () => {
    const failure = { code: '42501', message: 'permission denied for table students' };
    const query = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: failure }),
    };
    jest.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(studentsApi.createStudent({ id: 'student-1', first_name: 'Ada', last_name: 'Lovelace' })).rejects.toBe(failure);
  });

  it('shows the server explanation for a duplicate phone on Student edit unchanged', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ error: STUDENT_CONFLICT }),
      }),
    });

    await expect(studentsApi.updateStudent('student-1', { phone: '+61400000000' }))
      .rejects.toMatchObject({ message: STUDENT_CONFLICT });
  });
});
