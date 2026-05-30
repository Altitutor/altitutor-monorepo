import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function requireAdminStaff(): Promise<
  | {
      ok: true;
      staffId: string;
      admin: NonNullable<typeof supabaseAdmin>;
    }
  | { ok: false; response: Response }
> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  const { data: currentUserStaff, error: staffError } = await supabase
    .from('staff')
    .select('id, role')
    .eq('user_id', user.id)
    .single<{ id: string; role: string }>();

  if (staffError || !currentUserStaff || currentUserStaff.role !== 'ADMINSTAFF') {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  if (!supabaseAdmin) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  return { ok: true, staffId: currentUserStaff.id, admin: supabaseAdmin };
}
