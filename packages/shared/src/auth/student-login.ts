import { AuthError, AuthRetryableFetchError, type AuthResponse, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '../supabase/generated';

export function isStudentRecoveryEmail(email: string | null | undefined): boolean {
  return /^retired-[0-9a-f]{32}@accounts\.invalid$/i.test(email ?? '');
}

/** Only explicit sign-in restores a retired Student; session refresh never does. */
export async function restoreStudentAfterSignIn(client: SupabaseClient<Database>, user: User | null) {
  if (!user?.app_metadata?.retired_student_id) return;
  const { error } = await client.rpc('restore_my_deleted_student');
  if (error) throw new AuthError('Your Student record could not be restored. Please try again.');
}

export async function signInWithStudentLoginRecovery(
  client: SupabaseClient<Database>,
  credentials: { email: string; password: string },
  options: { restoreStudent?: boolean } = {},
) {
  let result: AuthResponse = await client.auth.signInWithPassword(credentials);
  if (result.error?.code === 'invalid_credentials') {
    let response: Response;
    try { response = await fetch('/api/auth/student-login-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    }); } catch {
      return { data: { user: null, session: null }, error: new AuthRetryableFetchError('Sign-in is temporarily unavailable.', 0) };
    }
    if (response.ok) {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'access_token' in body && 'refresh_token' in body &&
        typeof body.access_token === 'string' && typeof body.refresh_token === 'string') {
        result = await client.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
      }
    } else if (response.status === 429) {
      return { data: { user: null, session: null }, error: new AuthError('Too many attempts. Please try again shortly.', 429) };
    } else if (response.status !== 401) {
      return { data: { user: null, session: null }, error: new AuthRetryableFetchError('Sign-in is temporarily unavailable.', 503) };
    }
  }
  if (!result.error && options.restoreStudent) {
    try { await restoreStudentAfterSignIn(client, result.data.user); }
    catch { return { data: { user: null, session: null }, error: new AuthError('Your Student record could not be restored. Please try again.') }; }
  }
  return result;
}
