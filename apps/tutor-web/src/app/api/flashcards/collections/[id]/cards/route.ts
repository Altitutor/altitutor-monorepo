import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { hasClozeMarker } from '@altitutor/shared';

async function assertCollectionAccess(collectionId: string) {
  const userClient = createClient() as any;
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
    .from('vstaff_flashcards')
    .select('*')
    .eq('collection_id', params.id)
    .order('index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await assertCollectionAccess(params.id))) {
    return NextResponse.json({ error: 'Collection not accessible' }, { status: 403 });
  }

  const body = await request.json();
  if (!hasClozeMarker(body.cloze_text ?? '')) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }

  const userClient = createClient() as any;
  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const serviceClient = getServiceRoleClient() as any;
  const { data: siblings } = await serviceClient
    .from('flashcards')
    .select('index')
    .eq('collection_id', params.id)
    .is('deleted_at', null);

  const nextIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;
  const { data, error } = await serviceClient
    .from('flashcards')
    .insert({
      collection_id: params.id,
      title: body.title || null,
      cloze_text: body.cloze_text,
      extra: body.extra || null,
      index: body.index ?? nextIndex,
      created_by: staffId ?? null,
      updated_by: staffId ?? null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
