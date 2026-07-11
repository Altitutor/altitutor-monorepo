import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import {
  createDefaultContentBlock,
  type FormAccessType,
  type FormSubmissionLimit,
  type Json,
  type Tables,
} from '@altitutor/shared';

function asJson(value: unknown): Json {
  return value as Json;
}

export async function GET() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const admin = auth.admin;
  const { data: forms, error } = await admin
    .from('forms')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formRows = (forms ?? []) as Tables<'forms'>[];
  const formIds = formRows.map((form) => form.id);
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
    forms: formRows.map((form) => ({
      ...form,
      response_count: counts.get(form.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled form';
  const purpose = typeof body.purpose === 'string' && body.purpose.trim() ? body.purpose.trim() : 'other';
  const accessType: FormAccessType = body.accessType === 'authenticated' ? 'authenticated' : 'public_link';
  const submissionLimit: FormSubmissionLimit =
    body.submissionLimit === 'one_per_token' ||
    body.submissionLimit === 'one_per_authenticated_respondent' ||
    body.submissionLimit === 'unlimited'
      ? body.submissionLimit
      : 'unlimited';
  const workflowKey =
    body.workflowKey === 'student_unenrolment' || body.workflowKey === 'student_discontinuation'
      ? body.workflowKey
      : null;
  const workflowRequestExpiryDays =
    body.workflowRequestExpiryDays === null
      ? null
      : Number.isInteger(body.workflowRequestExpiryDays) && Number(body.workflowRequestExpiryDays) > 0
        ? Number(body.workflowRequestExpiryDays)
        : null;
  const draftBlocks = Array.isArray(body.blocks) ? body.blocks : [createDefaultContentBlock()];
  const thankYouMessage =
    typeof body.thankYouMessage === 'string' && body.thankYouMessage.trim()
      ? body.thankYouMessage
      : 'Thanks for your response.';

  const { data, error } = await auth.admin
    .from('forms')
    .insert({
      name,
      purpose,
      access_type: accessType,
      submission_limit: submissionLimit,
      workflow_key: workflowKey,
      workflow_request_expiry_days: workflowKey ? workflowRequestExpiryDays : null,
      draft_blocks: asJson(draftBlocks),
      draft_thank_you_message: thankYouMessage,
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
