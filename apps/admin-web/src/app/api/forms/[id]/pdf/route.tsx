import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { FormBlock } from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { FormPdfDocument } from '@/features/forms/server/FormPdfDocument';

export const runtime = 'nodejs';

function filename(value: string) {
  const safe = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${safe || 'form'}.pdf`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { data: form, error: formError } = await auth.admin
    .from('forms')
    .select('id, name, latest_published_version_id')
    .eq('id', params.id)
    .single();
  if (formError || !form) return Response.json({ error: formError?.message ?? 'Form not found' }, { status: 404 });
  if (!form.latest_published_version_id) return Response.json({ error: 'Publish this form before downloading it.' }, { status: 409 });

  const { data: version, error: versionError } = await auth.admin
    .from('form_versions')
    .select('blocks, version_number')
    .eq('id', form.latest_published_version_id)
    .single();
  if (versionError || !version) return Response.json({ error: versionError?.message ?? 'Published version not found' }, { status: 404 });

  const buffer = await renderToBuffer(
    <FormPdfDocument
      formName={form.name}
      versionNumber={version.version_number}
      blocks={(Array.isArray(version.blocks) ? version.blocks : []) as unknown as FormBlock[]}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename(form.name)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
