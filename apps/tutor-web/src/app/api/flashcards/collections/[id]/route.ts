import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

async function assertCollectionAccess(collectionId: string) {
  const userClient = createClient() as any;
  const { data: collection, error } = await userClient
    .from('vstaff_flashcard_collections')
    .select('id')
    .eq('id', collectionId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(collection);
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const userClient = createClient() as any;
  const { data, error } = await userClient
    .from('vstaff_flashcard_collections')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await assertCollectionAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const userClient = createClient() as any;
  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const serviceClient = getServiceRoleClient() as any;
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: staffId ?? null,
  };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.index !== undefined) updates.index = body.index;

  const { data, error } = await serviceClient
    .from('flashcard_collections')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await assertCollectionAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const userClient = createClient() as any;
  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const serviceClient = getServiceRoleClient() as any;
  const { error } = await serviceClient
    .from('flashcard_collections')
    .update({ deleted_at: new Date().toISOString(), deleted_by: staffId ?? null })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
