import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get('formId');
  const admin = auth.admin as any;

  let query = admin
    .from('form_responses')
    .select(`
      *,
      forms ( id, name, purpose ),
      form_versions ( id, version_number )
    `)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (formId) query = query.eq('form_id', formId);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ responses: data ?? [] });
}
