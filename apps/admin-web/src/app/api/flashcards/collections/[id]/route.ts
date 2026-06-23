import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

async function assertAdminCollectionAccess(collectionId: string) {
  const userClient = createClient() as any;
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return false;
  const { data } = await userClient
    .from('vstaff_flashcard_collections')
    .select('id')
    .eq('id', collectionId)
    .maybeSingle();
  return Boolean(data);
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
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  if (!(await assertAdminCollectionAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.index !== undefined) updates.index = body.index;

  const { data, error } = await (supabaseAdmin as any)
    .from('flashcard_collections')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  if (!(await assertAdminCollectionAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await (supabaseAdmin as any)
    .from('flashcard_collections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
