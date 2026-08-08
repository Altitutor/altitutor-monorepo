import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { validateFlashcardContent } from '@altitutor/shared';
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
  const cardType = body.card_type ?? existingCard.card_type;
  const contentError = validateFlashcardContent({
    cardType,
    clozeText: body.cloze_text !== undefined ? body.cloze_text : existingCard.cloze_text,
    imageFileId: body.image_file_id !== undefined ? body.image_file_id : existingCard.image_file_id,
    occlusionData: body.occlusion_data !== undefined ? body.occlusion_data : existingCard.occlusion_data,
  });
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
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
  if (body.card_type !== undefined) updates.card_type = cardType;
  if (body.cloze_text !== undefined || body.card_type !== undefined) updates.cloze_text = cardType === 'text_cloze' ? body.cloze_text ?? existingCard.cloze_text : null;
  if (body.extra !== undefined) updates.extra = body.extra || null;
  if (body.image_file_id !== undefined || body.card_type !== undefined) updates.image_file_id = cardType === 'image_occlusion' ? body.image_file_id ?? existingCard.image_file_id : null;
  if (body.image_alt_text !== undefined || body.card_type !== undefined) updates.image_alt_text = cardType === 'image_occlusion' ? body.image_alt_text || null : null;
  if (body.occlusion_data !== undefined || body.card_type !== undefined) updates.occlusion_data = cardType === 'image_occlusion' ? body.occlusion_data ?? existingCard.occlusion_data : null;

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
        const moveIndex = Math.max(0, ...newTopicCards.map((card) => card.index ?? 0)) + 1;
        const { error: moveError } = await serviceClient
          .from('flashcards')
          .update({ topic_id: targetTopicId, index: moveIndex })
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
    captureApiError(orderError, "/api/flashcards/cards/[id]");
    const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await serviceClient.from('flashcards').update(updates).eq('id', params.id).select('*').single();

  if (error) return captureApiErrorResponse(error, "/api/flashcards/cards/[id]", NextResponse.json({ error: error.message }, { status: 500 }));
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

  if (error) return captureApiErrorResponse(error, "/api/flashcards/cards/[id]", NextResponse.json({ error: error.message }, { status: 500 }));
  try {
    const siblings = (await listAccessibleFlashcards(existingCard.topic_id)).filter((card) => card.id !== params.id);
    await persistTopicFlashcardOrder(serviceClient, existingCard.topic_id, siblings.map((card) => card.id));
  } catch {
    // The delete already succeeded; stale gaps will be compacted by the next write.
  }
  return NextResponse.json({ success: true });
}
