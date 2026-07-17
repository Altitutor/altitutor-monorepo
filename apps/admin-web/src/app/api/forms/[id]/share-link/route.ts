import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { data: form, error } = await auth.admin
    .from('forms')
    .select('id, access_type, submission_limit, latest_published_version_id')
    .eq('id', params.id)
    .eq('status', 'published')
    .is('archived_at', null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!form?.latest_published_version_id) {
    return NextResponse.json({ error: 'Publish this form before creating a share link.' }, { status: 409 });
  }

  const token = randomBytes(24).toString('base64url');
  const { error: tokenError } = await auth.admin.from('form_tokens').insert({
    form_id: form.id,
    form_version_id: form.latest_published_version_id,
    token_hash: hashToken(token),
    access_type: form.access_type,
    submission_limit: form.submission_limit,
    created_by: auth.staffId,
  });
  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });

  return NextResponse.json({ token });
}
