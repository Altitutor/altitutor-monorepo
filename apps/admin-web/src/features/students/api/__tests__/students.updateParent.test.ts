import { studentsApi } from '../students';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

describe('parent update failures', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());
  function rejectWith(error: unknown) {
    const query = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error }) };
    jest.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof getSupabaseClient>);
  }
  it('explains a protected student-phone conflict without exposing record identifiers', async () => {
    rejectWith({ code: 'P0001', message: 'Phone number +61400000000 is already associated with a student (ID: 00000000-0000-0000-0000-000000000001)' });
    await expect(studentsApi.updateParent('parent-1', { phone: '+61400000000' })).rejects.toThrow('This phone number is already linked to a student. Use a different number for the parent, or check the student contact details.');
  });
  it('preserves actionable unexpected PostgREST messages', async () => {
    rejectWith({ code: '42501', message: 'permission denied for table parents' });
    await expect(studentsApi.updateParent('parent-1', {})).rejects.toThrow('Failed to update parent: permission denied for table parents');
  });
  it('uses a safe fallback for an unrecognized object', async () => {
    rejectWith({ code: 'UNKNOWN' });
    await expect(studentsApi.updateParent('parent-1', {})).rejects.toThrow('Failed to update parent. Please try again.');
  });
});
