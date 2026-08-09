import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveRegistrationStudentId(
  supabase: SupabaseClient<Database>,
  token: string
): Promise<string | null> {
  if (await isRegistrationTokenRevoked(supabase, token)) return null;

  const query = supabase.from('students').select('id');
  const { data, error } = UUID_REGEX.test(token)
    ? await query.or(
        `registration_public_token.eq.${token},legacy_registration_token.eq.${token}`
      ).maybeSingle()
    : await query.eq('registration_public_token', token).maybeSingle();

  return error ? null : data?.id ?? null;
}

export async function isRegistrationTokenRevoked(
  supabase: SupabaseClient<Database>,
  token: string
): Promise<boolean> {
  const { data } = await supabase
    .from('public_link_revocations')
    .select('token')
    .eq('purpose', 'REGISTRATION')
    .eq('token', token)
    .maybeSingle();

  return Boolean(data);
}
