import { NextResponse } from 'next/server';
import {
  type FormBlock,
} from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { resolveFormBlocks } from '@/features/forms/server/resolve-form-blocks';

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function asFormBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

function asPerson(value: unknown): PersonRow | null {
  if (!value || typeof value !== 'object') return null;
  const person = value as Partial<PersonRow>;
  if (typeof person.id !== 'string') return null;
  return {
    id: person.id,
    first_name: typeof person.first_name === 'string' ? person.first_name : null,
    last_name: typeof person.last_name === 'string' ? person.last_name : null,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  const admin = auth.admin;
  const [{ data: students }, { data: staff }, { data: forms }] = await Promise.all([
    admin.from('sessions_students').select('student:students(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('sessions_staff').select('staff:staff(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('forms').select('id, name, purpose, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, version_number, blocks, thank_you_message)')
      .eq('status', 'published').is('archived_at', null).is('workflow_key', null).not('latest_published_version_id', 'is', null).order('name'),
  ]);
  const studentRows = (students ?? [])
    .map((row) => asPerson(row.student))
    .filter((person): person is PersonRow => person !== null);
  const parentIds = studentRows.map((student) => student.id);
  const { data: parentLinks } = parentIds.length
    ? await admin.from('parents_students').select('parent:parents(id, first_name, last_name)').in('student_id', parentIds)
    : { data: [] as Array<{ parent: unknown }> };
  const resolvedForms = await Promise.all(((forms ?? []) as unknown as Array<{
    id: string;
    name: string;
    purpose: string;
    latest_published_version_id: string;
    form_versions: { id: string; version_number: number; blocks: unknown; thank_you_message: string } | null;
  }>).map(async (form) => ({
    ...form,
    form_versions: form.form_versions ? {
      ...form.form_versions,
      blocks: await resolveFormBlocks(admin, asFormBlocks(form.form_versions.blocks)),
    } : null,
  })));
  const parentRows = (parentLinks ?? [])
    .map((row) => asPerson(row.parent))
    .filter((person): person is PersonRow => person !== null);
  const uniqueParents = [...new Map(parentRows.map((person) => [person.id, person])).values()];
  return NextResponse.json({
    participants: [
      ...studentRows.map((person) => ({ ...person, type: 'student' as const })),
      ...(staff ?? [])
        .map((row) => asPerson(row.staff))
        .filter((person): person is PersonRow => person !== null)
        .map((person) => ({ ...person, type: 'staff' as const })),
      ...uniqueParents.map((person) => ({ ...person, type: 'parent' as const })),
    ],
    forms: resolvedForms,
  });
}
