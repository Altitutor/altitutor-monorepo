import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { validateFlashcardContent, type Flashcard } from '@altitutor/shared';
import { clampIndex, insertIdAtIndex, persistTopicFlashcardOrder } from './_lib';

async function assertTopicAccess(topicId: string) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return false;
  const { data } = await userClient.from('topics').select('id').eq('id', topicId).maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  const userClient = createClient();
  const { data, error } = await userClient
    .from('vstaff_flashcards')
    .select('*')
    .eq('topic_id', topicId)
    .order('index', { ascending: true });

  if (error) return captureApiErrorResponse(error, "/api/flashcards", NextResponse.json({ error: error.message }, { status: 500 }));
  const rows = (data ?? []) as unknown as Flashcard[];
  const enriched = await Promise.all(rows.map(async (row) => {
    if (!row.image_storage_path) return row;
    const { data: signed } = await userClient.storage.from('flashcard-images').createSignedUrl(row.image_storage_path, 3600);
    return { ...row, image_url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ data: enriched });
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const body = await request.json();
  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
  if (!(await assertTopicAccess(body.topic_id))) {
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

  const { data: siblings } = await supabaseAdmin
    .from('flashcards')
    .select('id,index')
    .eq('topic_id', body.topic_id)
    .is('deleted_at', null)
    .order('index', { ascending: true });

  const nextIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;
  const requestedIndex = body.index == null ? (siblings?.length ?? 0) + 1 : clampIndex(body.index, (siblings?.length ?? 0) + 1);
  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .insert({
      topic_id: body.topic_id,
      card_type: cardType,
      cloze_text: cardType === 'text_cloze' ? body.cloze_text : null,
      extra: body.extra || null,
      image_file_id: cardType === 'image_occlusion' ? body.image_file_id : null,
      image_alt_text: cardType === 'image_occlusion' ? body.image_alt_text || null : null,
      occlusion_data: cardType === 'image_occlusion' ? body.occlusion_data : null,
      index: nextIndex,
    })
    .select('*')
    .single();

  if (error) return captureApiErrorResponse(error, "/api/flashcards", NextResponse.json({ error: error.message }, { status: 500 }));

  if (body.index !== undefined) {
    try {
      await persistTopicFlashcardOrder(
        supabaseAdmin,
        body.topic_id,
        insertIdAtIndex((siblings ?? []).map((card) => card.id), data.id, requestedIndex),
      );
    } catch (orderError) {
      captureApiError(orderError, "/api/flashcards");
      const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data: reordered, error: reorderFetchError } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('id', data.id)
      .single();

    if (reorderFetchError) return captureApiErrorResponse(reorderFetchError, "/api/flashcards", NextResponse.json({ error: reorderFetchError.message }, { status: 500 }));
    return NextResponse.json({ data: reordered });
  }

  return NextResponse.json({ data });
}
