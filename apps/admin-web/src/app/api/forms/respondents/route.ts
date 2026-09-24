import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { createClient } from '@/shared/lib/supabase/server-ssr';

type RespondentType = 'student' | 'parent' | 'staff';
type PersonRow = { id: string; first_name: string | null; last_name: string | null };

function isRespondentType(value: string | null): value is RespondentType {
  return value === 'student' || value === 'parent' || value === 'staff';
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const search = params.get('search')?.trim() ?? '';
  if (!isRespondentType(type)) {
    return NextResponse.json({ error: 'Respondent type is required.' }, { status: 400 });
  }
  // Keep the caller's auth context: these search RPCs intentionally verify
  // is_adminstaff_active(), so the service-role client would return no rows.
  const userClient = createClient() as unknown as SupabaseClient<Database>;

  if (type === 'student') {
    const { data, error } = await userClient.rpc('search_students_admin', {
      p_search: search || undefined,
      p_statuses: ['ACTIVE', 'TRIAL'],
      p_include_relationships: false,
      p_exclude_class_search: true,
      p_limit: 30,
      p_offset: 0,
      p_order_by: 'first_name',
      p_ascending: true,
    });
    if (error) return captureApiErrorResponse(error, "/api/forms/respondents", NextResponse.json({ error: error.message }, { status: 500 }));
    const result = data as { students?: PersonRow[] } | null;
    return NextResponse.json({ people: result?.students ?? [] });
  }

  if (type === 'staff') {
    const { data, error } = await userClient.rpc('search_staff_admin', {
      p_search: search || undefined,
      p_statuses: ['ACTIVE'],
      p_include_relationships: false,
      p_exclude_class_search: true,
      p_limit: 30,
      p_offset: 0,
      p_order_by: 'first_name',
      p_ascending: true,
    });
    if (error) return captureApiErrorResponse(error, "/api/forms/respondents", NextResponse.json({ error: error.message }, { status: 500 }));
    const result = data as { staff?: PersonRow[] } | null;
    return NextResponse.json({ people: result?.staff ?? [] });
  }

  const { data, error } = await userClient.rpc('search_parents_admin', {
    p_search: search || undefined,
    p_include_relationships: false,
    p_limit: 30,
    p_offset: 0,
    p_order_by: 'first_name',
    p_ascending: true,
  });
  if (error) return captureApiErrorResponse(error, "/api/forms/respondents", NextResponse.json({ error: error.message }, { status: 500 }));
  const result = data as { parents?: PersonRow[] } | null;
  return NextResponse.json({ people: result?.parents ?? [] });
}
