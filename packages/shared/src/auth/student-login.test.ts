import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/generated';
import { signInWithStudentLoginRecovery } from './student-login';

const credentials = { email: 'reused@example.test', password: 'original-password' };
const success = { data: { user: { id: 'original', app_metadata: { retired_student_id: 'student' } }, session: {} }, error: null };

function fixture(result: unknown) {
  const auth = { signInWithPassword: jest.fn().mockResolvedValue(result), setSession: jest.fn().mockResolvedValue(success) };
  const rpc = jest.fn().mockResolvedValue({ data: 'student', error: null });
  return { auth, rpc, client: { auth, rpc } as unknown as SupabaseClient<Database> };
}

describe('Student login recovery', () => {
  beforeEach(() => { globalThis.fetch = jest.fn(); });
  it('restores only after a successful Student login carrying the server retirement flag', async () => {
    const { client, rpc } = fixture(success);
    await signInWithStudentLoginRecovery(client, credentials, { restoreStudent: true });
    expect(rpc).toHaveBeenCalledWith('restore_my_deleted_student');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not restore a Student when signing into a staff portal', async () => {
    const { client, rpc } = fixture(success);
    await signInWithStudentLoginRecovery(client, credentials);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('tries retained credentials only after invalid credentials, then installs the verified session', async () => {
    const { client, auth, rpc } = fixture({ data: { user: null, session: null }, error: new AuthApiError('Invalid credentials', 400, 'invalid_credentials') });
    jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh' })));
    const result = await signInWithStudentLoginRecovery(client, credentials, { restoreStudent: true });
    expect(result.error).toBeNull();
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('preserves network failures and never sends them to the credential fallback', async () => {
    const error = new AuthApiError('Unavailable', 503, 'unexpected_failure');
    const { client } = fixture({ data: { user: null, session: null }, error });
    expect((await signInWithStudentLoginRecovery(client, credentials)).error).toBe(error);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails sign-in if restoration cannot complete', async () => {
    const { client, rpc } = fixture(success);
    rpc.mockResolvedValue({ data: null, error: { message: 'internal detail' } });
    const result = await signInWithStudentLoginRecovery(client, credentials, { restoreStudent: true });
    expect(result.error?.message).toBe('Your Student record could not be restored. Please try again.');
  });
});
