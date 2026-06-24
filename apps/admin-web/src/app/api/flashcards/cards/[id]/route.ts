import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { hasClozeMarker } from '@altitutor/shared';
import { clampIndex, insertIdAtIndex, persistTopicFlashcardOrder } from '../../_lib';

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

    const { data: siblings, error: siblingsError } = await supabaseAdmin
      .from('flashcards')
      .select('id,index')
      .eq('topic_id', targetTopicId)
      .is('deleted_at', null)
      .neq('id', params.id)
      .order('index', { ascending: true });

    if (siblingsError) return NextResponse.json({ error: siblingsError.message }, { status: 500 });

    const targetIndex = clampIndex(body.index ?? current.index, (siblings?.length ?? 0) + 1);
    const orderedTargetIds = insertIdAtIndex((siblings ?? []).map((card) => card.id), params.id, targetIndex);

    try {
      if (targetTopicId !== current.topic_id) {
        const moveIndex = Math.max(0, ...(siblings ?? []).map((card) => card.index ?? 0)) + 1;
        const { error: moveError } = await supabaseAdmin
          .from('flashcards')
          .update({ ...updates, topic_id: targetTopicId, index: moveIndex })
          .eq('id', params.id);
        if (moveError) throw moveError;

        const { data: previousSiblings, error: previousSiblingsError } = await supabaseAdmin
          .from('flashcards')
          .select('id')
          .eq('topic_id', current.topic_id)
          .is('deleted_at', null)
          .order('index', { ascending: true });
        if (previousSiblingsError) throw previousSiblingsError;

        await persistTopicFlashcardOrder(
          supabaseAdmin,
          current.topic_id,
          (previousSiblings ?? []).map((card) => card.id),
        );
      }

      await persistTopicFlashcardOrder(supabaseAdmin, targetTopicId, orderedTargetIds);
    } catch (orderError) {
      const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (targetTopicId === current.topic_id && Object.keys(updates).length > 1) {
      const { error: updateError } = await supabaseAdmin
        .from('flashcards')
        .update(updates)
        .eq('id', params.id);

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
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
