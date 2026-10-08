import { studentsApi } from '../students';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('studentsApi.listMinimal class enrolments', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    ['current', '2026-01-01T00:00:00Z', null],
    ['future', '2026-11-01T00:00:00Z', null],
    ['scheduled to end later', '2026-01-01T00:00:00Z', '2026-11-01T00:00:00Z'],
  ])(
    'returns a %s enrolment for the Classes column with a minimal RPC response',
    async (_label, enrolledAt, unenrolledAt) => {
      jest.useFakeTimers({
        now: new Date('2026-10-08T00:00:00Z'),
        doNotFake: ['nextTick'],
      });
      const subject = { id: 'subject-1', short_name: 'Maths' };
      const enrolledClass = {
        id: 'class-1',
        short_name: 'Maths Monday',
        long_name: 'Year 12 Maths Monday',
        day_of_week: 1,
        start_time: '16:00:00',
        level: null,
        subject_details: subject,
      };
      const rpc = jest.fn().mockResolvedValue({
        data: {
          students: [
            { id: 'student-1', classes: [] },
            { id: 'student-2', classes: [] },
          ],
          total: 2,
        },
        error: null,
      });
      const enrolmentFilter = jest.fn().mockReturnThis();
      const enrolmentIds = jest.fn().mockResolvedValue({
        data: [
          {
            student_id: 'student-1',
            enrolled_at: enrolledAt,
            unenrolled_at: unenrolledAt,
            class: enrolledClass,
          },
        ],
        error: null,
      });
      const from = jest.fn((table: string) => {
        const query = {
          select: jest.fn().mockReturnThis(),
          or: enrolmentFilter,
          in:
            table === 'classes_students'
              ? enrolmentIds
              : jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
        };
        return query;
      });
      jest
        .mocked(getSupabaseClient)
        .mockReturnValue({ rpc, from } as unknown as ReturnType<
          typeof getSupabaseClient
        >);

      const result = await studentsApi.listMinimal({});

      expect(result.students[0].classes).toEqual([
        expect.objectContaining({
          id: 'class-1',
          short_name: 'Maths Monday',
          subject,
        }),
      ]);
      expect(result.students[0].subjects).toEqual([subject]);
      expect(result.students[1].classes).toEqual([]);
      expect(result.total).toBe(2);
      expect(enrolmentIds).toHaveBeenCalledWith('student_id', [
        'student-1',
        'student-2',
      ]);
      expect(enrolmentFilter).toHaveBeenCalledWith(
        'unenrolled_at.is.null,unenrolled_at.gt.2026-10-08T00:00:00.000Z',
      );
      expect(rpc).toHaveBeenCalledWith(
        'search_students_admin',
        expect.objectContaining({ p_include_relationships: false }),
      );
    },
  );
});
