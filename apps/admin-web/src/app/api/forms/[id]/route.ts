import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { validateFormDefinition } from '@altitutor/shared';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const admin = auth.admin as any;
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

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    updated_by: auth.staffId,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string') patch.name = body.name.trim() || 'Untitled form';
  if (typeof body.purpose === 'string') patch.purpose = body.purpose.trim() || 'other';
  if (body.accessType === 'public_link' || body.accessType === 'authenticated') patch.access_type = body.accessType;
  if (
    body.submissionLimit === 'one_per_token' ||
    body.submissionLimit === 'one_per_authenticated_respondent' ||
    body.submissionLimit === 'unlimited'
  ) {
    patch.submission_limit = body.submissionLimit;
  }
  if (Array.isArray(body.blocks)) {
    const errors = validateFormDefinition({
      blocks: body.blocks,
      thankYouMessage: typeof body.thankYouMessage === 'string' ? body.thankYouMessage : 'Thanks for your response.',
    });
    if (errors.some((message) => message.includes('button link'))) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
    }
    patch.draft_blocks = body.blocks;
  }
  if (typeof body.thankYouMessage === 'string') patch.draft_thank_you_message = body.thankYouMessage;

  const { data, error } = await (auth.admin as any)
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
