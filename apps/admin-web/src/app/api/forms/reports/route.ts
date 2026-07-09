import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get('formId');
  const versionId = searchParams.get('versionId');
  if (!formId) {
    return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  }

  const admin = auth.admin as any;
  const { data: form, error: formError } = await admin
    .from('forms')
    .select('id, name, latest_published_version_id')
    .eq('id', formId)
    .single();
  if (formError || !form) {
    return NextResponse.json({ error: formError?.message ?? 'Form not found' }, { status: 404 });
  }

  const selectedVersionId = versionId ?? form.latest_published_version_id;
  if (!selectedVersionId) {
    return NextResponse.json({ report: null });
  }

  const [{ data: version }, { data: answers }, { count }] = await Promise.all([
    admin.from('form_versions').select('*').eq('id', selectedVersionId).single(),
    admin
      .from('form_response_answers')
      .select('*')
      .eq('form_version_id', selectedVersionId)
      .order('created_at', { ascending: false }),
    admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_version_id', selectedVersionId)
      .is('deleted_at', null),
  ]);

  return NextResponse.json({
    report: {
      form,
      version,
      responseCount: count ?? 0,
      answers: answers ?? [],
    },
  });
}
