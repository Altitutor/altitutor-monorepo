import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { hasClozeMarker } from '@altitutor/shared';
import {
  assertTutorTopicAccess,
  getAccessibleFlashcard,
  insertIdAtIndex,
  listAccessibleFlashcards,
  persistTopicFlashcardOrder,
} from '../../_lib';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existingCard = await getAccessibleFlashcard(params.id);
  if (!existingCard) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  if (body.cloze_text !== undefined && !hasClozeMarker(body.cloze_text)) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }
  const targetTopicId = body.topic_id ?? existingCard.topic_id;
  if (targetTopicId !== existingCard.topic_id && !(await assertTutorTopicAccess(targetTopicId))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }

  const userClient = createClient();
  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: staffId ?? null,
  };
  if (body.cloze_text !== undefined) updates.cloze_text = body.cloze_text;
  if (body.extra !== undefined) updates.extra = body.extra || null;

  const serviceClient = getServiceRoleClient();
  try {
    if (body.topic_id !== undefined || body.index !== undefined) {
      const oldTopicCards = await listAccessibleFlashcards(existingCard.topic_id);
      const newTopicCards = targetTopicId === existingCard.topic_id
        ? oldTopicCards
        : await listAccessibleFlashcards(targetTopicId);
      const requestedIndex = body.index ?? existingCard.index;

      if (targetTopicId === existingCard.topic_id) {
        await persistTopicFlashcardOrder(
          serviceClient,
          existingCard.topic_id,
          insertIdAtIndex(oldTopicCards.map((card) => card.id), params.id, requestedIndex),
        );
      } else {
        await persistTopicFlashcardOrder(
          serviceClient,
          existingCard.topic_id,
          oldTopicCards.map((card) => card.id),
        );
        const { error: moveError } = await serviceClient
          .from('flashcards')
          .update({ topic_id: targetTopicId, index: -(newTopicCards.length + 1) })
          .eq('id', params.id);
        if (moveError) throw moveError;

        await persistTopicFlashcardOrder(
          serviceClient,
          existingCard.topic_id,
          oldTopicCards.filter((card) => card.id !== params.id).map((card) => card.id),
        );
        await persistTopicFlashcardOrder(
          serviceClient,
          targetTopicId,
          insertIdAtIndex(
            newTopicCards.filter((card) => card.id !== params.id).map((card) => card.id),
            params.id,
            requestedIndex,
          ),
        );
      }
    }
  } catch (orderError) {
    const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await serviceClient.from('flashcards').update(updates).eq('id', params.id).select('*').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existingCard = await getAccessibleFlashcard(params.id);
  if (!existingCard) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const userClient = createClient();
  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const serviceClient = getServiceRoleClient();
  const { error } = await serviceClient
    .from('flashcards')
    .update({ deleted_at: new Date().toISOString(), deleted_by: staffId ?? null })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const siblings = (await listAccessibleFlashcards(existingCard.topic_id)).filter((card) => card.id !== params.id);
    await persistTopicFlashcardOrder(serviceClient, existingCard.topic_id, siblings.map((card) => card.id));
  } catch {
    // The delete already succeeded; stale gaps will be compacted by the next write.
  }
  return NextResponse.json({ success: true });
}
