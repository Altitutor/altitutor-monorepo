import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import {
  createDefaultContentBlock,
  type FormAccessType,
  type FormSubmissionLimit,
} from '@altitutor/shared';

export async function GET() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const admin = auth.admin as any;
  const { data: forms, error } = await admin
    .from('forms')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formIds = (forms ?? []).map((form: { id: string }) => form.id);
  let counts = new Map<string, number>();
  if (formIds.length) {
    const { data: responses } = await admin
      .from('form_responses')
      .select('form_id')
      .in('form_id', formIds)
      .is('deleted_at', null);
    counts = new Map<string, number>();
    for (const response of responses ?? []) {
      counts.set(response.form_id, (counts.get(response.form_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    forms: (forms ?? []).map((form: any) => ({
      ...form,
      response_count: counts.get(form.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled form';
  const purpose = typeof body.purpose === 'string' && body.purpose.trim() ? body.purpose.trim() : 'other';
  const accessType: FormAccessType = body.accessType === 'authenticated' ? 'authenticated' : 'public_link';
  const submissionLimit: FormSubmissionLimit =
    body.submissionLimit === 'one_per_token' ||
    body.submissionLimit === 'one_per_authenticated_respondent' ||
    body.submissionLimit === 'unlimited'
      ? body.submissionLimit
      : 'unlimited';

  const { data, error } = await (auth.admin as any)
    .from('forms')
    .insert({
      name,
      purpose,
      access_type: accessType,
      submission_limit: submissionLimit,
      draft_blocks: [createDefaultContentBlock()],
      created_by: auth.staffId,
      updated_by: auth.staffId,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ form: data });
}
