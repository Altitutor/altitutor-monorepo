import { captureApiError } from '@/lib/sentry/capture-api-error';
import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { validateFormDefinition, type FormBlock } from '@altitutor/shared';

function asFormBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const admin = auth.admin;
  const { data: form, error: formError } = await admin
    .from('forms')
    .select('*')
    .eq('id', params.id)
    .single();

  if (formError || !form) {
    return NextResponse.json({ error: formError?.message ?? 'Form not found' }, { status: 404 });
  }

  const errors = validateFormDefinition({
    blocks: asFormBlocks(form.draft_blocks),
    thankYouMessage: form.draft_thank_you_message,
  });
  if (errors.length) {
    return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
  }

  const { data: latest } = await admin
    .from('form_versions')
    .select('version_number')
    .eq('form_id', params.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (latest?.version_number ?? 0) + 1;
  const { data: version, error: versionError } = await admin
    .from('form_versions')
    .insert({
      form_id: params.id,
      version_number: versionNumber,
      blocks: form.draft_blocks,
      thank_you_message: form.draft_thank_you_message,
      published_by: auth.staffId,
    })
    .select('*')
    .single();

  if (versionError) {
    captureApiError(versionError, "/api/forms/[id]/publish");
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  const token = randomBytes(24).toString('base64url');
  const { data: formToken, error: tokenError } = await admin
    .from('form_tokens')
    .insert({
      form_id: params.id,
      form_version_id: version.id,
      token_hash: hashToken(token),
      access_type: form.access_type,
      submission_limit: form.submission_limit,
      created_by: auth.staffId,
    })
    .select('*')
    .single();

  if (tokenError) {
    captureApiError(tokenError, "/api/forms/[id]/publish");
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  await admin
    .from('forms')
    .update({
      latest_published_version_id: version.id,
      status: 'published',
      updated_by: auth.staffId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({
    version,
    token,
    formToken,
  });
}
