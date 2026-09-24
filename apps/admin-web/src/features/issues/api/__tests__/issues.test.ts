import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { issuesApi } from '../issues';

jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('issuesApi.get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when a reactive detail refetch runs after the issue was deleted', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockGetSupabaseClient.mockReturnValue(
      { from } as unknown as ReturnType<typeof getSupabaseClient>
    );

    await expect(issuesApi.get('deleted-issue')).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('issues');
    expect(eq).toHaveBeenCalledWith('id', 'deleted-issue');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('still rejects genuine database failures', async () => {
    const permissionError = { code: '42501', message: 'permission denied for table issues' };
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: permissionError });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockGetSupabaseClient.mockReturnValue(
      { from } as unknown as ReturnType<typeof getSupabaseClient>
    );

    await expect(issuesApi.get('issue-1')).rejects.toMatchObject(permissionError);
  });
});
