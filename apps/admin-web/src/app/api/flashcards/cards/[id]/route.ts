import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { hasClozeMarker } from '@altitutor/shared';

async function assertCardAccess(cardId: string) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return false;
  const { data } = await userClient
    .from('vstaff_flashcards')
    .select('id')
    .eq('id', cardId)
    .maybeSingle();
  return Boolean(data);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  if (!(await assertCardAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  if (body.cloze_text !== undefined && !hasClozeMarker(body.cloze_text)) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.cloze_text !== undefined) updates.cloze_text = body.cloze_text;
  if (body.extra !== undefined) updates.extra = body.extra || null;
  if (body.index !== undefined) updates.index = body.index;

  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  if (!(await assertCardAccess(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('flashcards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
