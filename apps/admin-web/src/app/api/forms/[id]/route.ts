import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import {
  validateFormDefinition,
  type FormBlock,
  type Json,
  type TablesUpdate,
} from '@altitutor/shared';

function asFormBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

function asJson(value: unknown): Json {
  return value as Json;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const admin = auth.admin;
  const [{ data: form, error }, { data: versions }, { data: tokens }] = await Promise.all([
    admin.from('forms').select('*').eq('id', params.id).single(),
    admin.from('form_versions').select('*').eq('form_id', params.id).order('version_number', { ascending: false }),
    admin.from('form_tokens').select('*').eq('form_id', params.id).order('created_at', { ascending: false }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ form, versions: versions ?? [], tokens: tokens ?? [] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const patch: TablesUpdate<'forms'> = {
    updated_by: auth.staffId,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string') patch.name = body.name.trim() || 'Untitled form';
  if (typeof body.purpose === 'string') patch.purpose = body.purpose.trim() || 'other';
  if (body.workflowKey === 'student_unenrolment' || body.workflowKey === 'student_discontinuation') {
    patch.workflow_key = body.workflowKey;
  } else if (body.workflowKey === null) {
    patch.workflow_key = null;
  }
  if (body.workflowRequestExpiryDays === null) {
    patch.workflow_request_expiry_days = null;
  } else if (Number.isInteger(body.workflowRequestExpiryDays) && Number(body.workflowRequestExpiryDays) > 0) {
    patch.workflow_request_expiry_days = Number(body.workflowRequestExpiryDays);
  }
  if (body.accessType === 'public_link' || body.accessType === 'authenticated') patch.access_type = body.accessType;
  if (
    body.submissionLimit === 'one_per_token' ||
    body.submissionLimit === 'one_per_authenticated_respondent' ||
    body.submissionLimit === 'unlimited'
  ) {
    patch.submission_limit = body.submissionLimit;
  }
  if (Array.isArray(body.blocks)) {
    const blocks = asFormBlocks(body.blocks);
    const errors = validateFormDefinition({
      blocks,
      thankYouMessage: typeof body.thankYouMessage === 'string' ? body.thankYouMessage : 'Thanks for your response.',
    });
    if (errors.some((message) => message.includes('button link'))) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
    }
    patch.draft_blocks = asJson(blocks);
  }
  if (typeof body.thankYouMessage === 'string') patch.draft_thank_you_message = body.thankYouMessage;

  const { data, error } = await auth.admin
    .from('forms')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ form: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const now = new Date().toISOString();
  const [{ data: form, error }, { error: revokeError }] = await Promise.all([
    auth.admin
      .from('forms')
      .update({
        status: 'archived',
        archived_at: now,
        updated_by: auth.staffId,
        updated_at: now,
      })
      .eq('id', params.id)
      .is('archived_at', null)
      .select('*')
      .maybeSingle(),
    auth.admin
      .from('form_tokens')
      .update({ revoked_at: now })
      .eq('form_id', params.id)
      .is('revoked_at', null),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  return NextResponse.json({ form });
}
