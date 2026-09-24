import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import {
  validateFlashcardContent,
  type Flashcard,
  type TablesUpdate,
} from '@altitutor/shared';
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
  const { data: currentRow, error: currentRowError } = await supabaseAdmin
    .from('flashcards')
    .select('*')
    .eq('id', params.id)
    .single();
  if (currentRowError || !currentRow) return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
  const existingCard = currentRow as unknown as Flashcard;
  const cardType = body.card_type ?? existingCard.card_type;
  const contentError = validateFlashcardContent({
    cardType,
    clozeText: body.cloze_text !== undefined ? body.cloze_text : existingCard.cloze_text,
    imageFileId: body.image_file_id !== undefined ? body.image_file_id : existingCard.image_file_id,
    occlusionData: body.occlusion_data !== undefined ? body.occlusion_data : existingCard.occlusion_data,
  });
  if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });
  if (cardType === 'image_occlusion' && body.image_file_id && body.image_file_id !== existingCard.image_file_id) {
    const targetTopicId = body.topic_id ?? existingCard.topic_id;
    const { data: imageFile } = await supabaseAdmin.from('files').select('id,bucket,storage_path,deleted_at').eq('id', body.image_file_id).maybeSingle();
    if (!imageFile || imageFile.deleted_at || imageFile.bucket !== 'flashcard-images' || !imageFile.storage_path?.startsWith(`${targetTopicId}/`)) {
      return NextResponse.json({ error: 'Source image is not accessible for this topic' }, { status: 400 });
    }
  }
  if (body.topic_id !== undefined && !(await assertTopicAccess(body.topic_id))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }

  const updates: TablesUpdate<'flashcards'> = { updated_at: new Date().toISOString() };
  if (body.card_type !== undefined) updates.card_type = cardType;
  if (body.cloze_text !== undefined || body.card_type !== undefined) updates.cloze_text = cardType === 'text_cloze' ? body.cloze_text ?? existingCard.cloze_text : null;
  if (body.extra !== undefined) updates.extra = body.extra || null;
  if (body.topic_id !== undefined) updates.topic_id = body.topic_id;
  if (body.image_file_id !== undefined || body.card_type !== undefined) updates.image_file_id = cardType === 'image_occlusion' ? body.image_file_id ?? existingCard.image_file_id : null;
  if (body.image_alt_text !== undefined || body.card_type !== undefined) updates.image_alt_text = cardType === 'image_occlusion' ? body.image_alt_text || null : null;
  if (body.occlusion_data !== undefined || body.card_type !== undefined) updates.occlusion_data = cardType === 'image_occlusion' ? body.occlusion_data ?? existingCard.occlusion_data : null;

  if (body.index !== undefined || body.topic_id !== undefined) {
    const current = currentRow;

    const targetTopicId = String(body.topic_id ?? current.topic_id);

    const { data: siblings, error: siblingsError } = await supabaseAdmin
      .from('flashcards')
      .select('id,index')
      .eq('topic_id', targetTopicId)
      .is('deleted_at', null)
      .neq('id', params.id)
      .order('index', { ascending: true });

    if (siblingsError) return captureApiErrorResponse(siblingsError, "/api/flashcards/cards/[id]", NextResponse.json({ error: siblingsError.message }, { status: 500 }));

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
      captureApiError(orderError, "/api/flashcards/cards/[id]");
      const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (targetTopicId === current.topic_id && Object.keys(updates).length > 1) {
      const { error: updateError } = await supabaseAdmin
        .from('flashcards')
        .update(updates)
        .eq('id', params.id);

      if (updateError) return captureApiErrorResponse(updateError, "/api/flashcards/cards/[id]", NextResponse.json({ error: updateError.message }, { status: 500 }));
    }

    const { data, error } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) return captureApiErrorResponse(error, "/api/flashcards/cards/[id]", NextResponse.json({ error: error.message }, { status: 500 }));
    return NextResponse.json({ data });
  }

  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return captureApiErrorResponse(error, "/api/flashcards/cards/[id]", NextResponse.json({ error: error.message }, { status: 500 }));
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

  if (error) return captureApiErrorResponse(error, "/api/flashcards/cards/[id]", NextResponse.json({ error: error.message }, { status: 500 }));
  return NextResponse.json({ success: true });
}
