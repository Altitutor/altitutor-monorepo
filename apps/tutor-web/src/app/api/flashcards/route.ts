import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { validateFlashcardContent } from '@altitutor/shared';
import {
  assertTutorTopicAccess,
  clampIndex,
  insertIdAtIndex,
  listAccessibleFlashcards,
  persistTopicFlashcardOrder,
} from './_lib';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  try {
    const data = await listAccessibleFlashcards(topicId);
    return NextResponse.json({ data });
  } catch (error) {
    captureApiError(error, "/api/flashcards");
    const message = error instanceof Error ? error.message : 'Unable to fetch flashcards';
    return NextResponse.json({ error: message }, { status: message === 'Topic not accessible' ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userClient = createClient();

  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
  if (!(await assertTutorTopicAccess(body.topic_id))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }
  const cardType = body.card_type ?? 'text_cloze';
  const contentError = validateFlashcardContent({
    cardType,
    clozeText: body.cloze_text,
    imageFileId: body.image_file_id,
    occlusionData: body.occlusion_data,
  });
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
  if (cardType === 'image_occlusion') {
    const serviceClient = getServiceRoleClient();
    const { data: imageFile } = await serviceClient.from('files').select('id,bucket,storage_path,deleted_at').eq('id', body.image_file_id).maybeSingle();
    if (!imageFile || imageFile.deleted_at || imageFile.bucket !== 'flashcard-images' || !imageFile.storage_path?.startsWith(`${body.topic_id}/`)) {
      return NextResponse.json({ error: 'Source image is not accessible for this topic' }, { status: 400 });
    }
  }

  const siblings = await listAccessibleFlashcards(body.topic_id);
  const nextIndex = siblings.length + 1;
  const requestedIndex = body.index == null ? nextIndex : clampIndex(body.index, nextIndex);
  const insertIndex = Math.max(0, ...siblings.map((card) => card.index ?? 0)) + 1;
  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from('flashcards')
    .insert({
      topic_id: body.topic_id,
      card_type: cardType,
      cloze_text: cardType === 'text_cloze' ? body.cloze_text : null,
      extra: body.extra || null,
      image_file_id: cardType === 'image_occlusion' ? body.image_file_id : null,
      image_alt_text: cardType === 'image_occlusion' ? body.image_alt_text || null : null,
      occlusion_data: cardType === 'image_occlusion' ? body.occlusion_data : null,
      index: insertIndex,
      created_by: (await userClient.rpc('current_tutor_id')).data ?? null,
    })
    .select('*')
    .single();

  if (error) return captureApiErrorResponse(error, "/api/flashcards", NextResponse.json({ error: error.message }, { status: 500 }));

  try {
    await persistTopicFlashcardOrder(
      serviceClient,
      body.topic_id,
      insertIdAtIndex(siblings.map((card) => card.id), data.id, requestedIndex),
    );
  } catch (orderError) {
    captureApiError(orderError, "/api/flashcards");
    const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
