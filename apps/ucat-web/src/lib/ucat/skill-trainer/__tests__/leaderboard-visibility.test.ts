import { getLeaderboard } from '@/lib/ucat/skill-trainer/attempt-service';

describe('getLeaderboard', () => {
  it('excludes internal test accounts from shared rankings', async () => {
    const trainerQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'trainer-1', key: 'mental_maths' },
        error: null,
      }),
    };
    trainerQuery.select.mockReturnValue(trainerQuery);
    trainerQuery.eq.mockReturnValue(trainerQuery);

    const attemptQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      not: jest.fn(),
      order: jest.fn(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    attemptQuery.select.mockReturnValue(attemptQuery);
    attemptQuery.eq.mockReturnValue(attemptQuery);
    attemptQuery.not.mockReturnValue(attemptQuery);
    attemptQuery.order.mockReturnValue(attemptQuery);

    const from = jest.fn((table: string) =>
      table === 'ucat_skill_trainers' ? trainerQuery : attemptQuery
    );
    const client = { from } as unknown as Parameters<typeof getLeaderboard>[0];

    await getLeaderboard(client, 'mental_maths', 'all_time', 'UTC');

    expect(attemptQuery.eq).toHaveBeenCalledWith('students.account_class', 'external');
  });
});
