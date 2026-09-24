import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { resourcesApi } from '../resources';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;

describe('resourcesApi subject lists', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('loads navigation subjects from vstudent_online_subjects', async () => {
    const subjectQuery = {
      select: jest.fn(),
      order: jest.fn(),
    };
    subjectQuery.select.mockReturnValue(subjectQuery);
    subjectQuery.order
      .mockReturnValueOnce(subjectQuery)
      .mockReturnValueOnce(subjectQuery)
      .mockResolvedValueOnce({
        data: [{ id: 'accessible-subject', name: 'Accessible subject' }],
        error: null,
      });

    const from = jest.fn((view: string) => {
      if (view === 'vstudent_online_subjects') return subjectQuery;
      throw new Error(`Unexpected view: ${view}`);
    });
    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    const result = await resourcesApi.getMySubjectNavItems();

    expect(from).toHaveBeenCalledWith('vstudent_online_subjects');
    expect(result).toEqual([{ id: 'accessible-subject', name: 'Accessible subject' }]);
  });

  it('returns no navigation subjects when the student has no resource access', async () => {
    const subjectQuery = {
      select: jest.fn(),
      order: jest.fn(),
    };
    subjectQuery.select.mockReturnValue(subjectQuery);
    subjectQuery.order
      .mockReturnValueOnce(subjectQuery)
      .mockReturnValueOnce(subjectQuery)
      .mockResolvedValueOnce({ data: [], error: null });
    const from = jest.fn(() => subjectQuery);
    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(resourcesApi.getMySubjectNavItems()).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('vstudent_online_subjects');
  });
});
