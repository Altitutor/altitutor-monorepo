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

async function assertTopicAccess(topicId: string) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return false;
  const { data } = await userClient.from('topics').select('id').eq('id', topicId).maybeSingle();
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
  if (body.topic_id !== undefined && !(await assertTopicAccess(body.topic_id))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.cloze_text !== undefined) updates.cloze_text = body.cloze_text;
  if (body.extra !== undefined) updates.extra = body.extra || null;
  if (body.topic_id !== undefined) updates.topic_id = body.topic_id;

  if (body.index !== undefined || body.topic_id !== undefined) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ error: currentError?.message ?? 'Flashcard not found' }, { status: 404 });
    }

    const targetTopicId = String(body.topic_id ?? current.topic_id);
    const targetIndexRaw = Number(body.index ?? current.index);

    const { data: siblings, error: siblingsError } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('topic_id', targetTopicId)
      .is('deleted_at', null)
      .neq('id', params.id)
      .order('index', { ascending: true });

    if (siblingsError) return NextResponse.json({ error: siblingsError.message }, { status: 500 });

    const targetIndex = Math.min(
      Math.max(Number.isFinite(targetIndexRaw) ? Math.trunc(targetIndexRaw) : current.index, 1),
      (siblings?.length ?? 0) + 1,
    );
    const moved = { ...current, ...updates, topic_id: targetTopicId, index: targetIndex };
    const ordered = [...(siblings ?? [])];
    ordered.splice(targetIndex - 1, 0, moved);

    for (const [idx, card] of ordered.entries()) {
      const cardUpdates: Record<string, unknown> = {
        updated_at: card.id === params.id ? updates.updated_at : new Date().toISOString(),
        index: idx + 1,
      };
      if (card.id === params.id) {
        Object.assign(cardUpdates, updates);
        cardUpdates.topic_id = targetTopicId;
      }

      const { error: updateError } = await supabaseAdmin
        .from('flashcards')
        .update(cardUpdates)
        .eq('id', card.id);

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (targetTopicId !== current.topic_id) {
      const { data: previousSiblings, error: previousSiblingsError } = await supabaseAdmin
        .from('flashcards')
        .select('id')
        .eq('topic_id', current.topic_id)
        .is('deleted_at', null)
        .neq('id', params.id)
        .order('index', { ascending: true });

      if (previousSiblingsError) return NextResponse.json({ error: previousSiblingsError.message }, { status: 500 });

      for (const [idx, card] of (previousSiblings ?? []).entries()) {
        const { error: updateError } = await supabaseAdmin
          .from('flashcards')
          .update({ index: idx + 1, updated_at: new Date().toISOString() })
          .eq('id', card.id);

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

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
