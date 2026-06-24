import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { hasClozeMarker } from '@altitutor/shared';
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
  if (!hasClozeMarker(body.cloze_text ?? '')) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }

  const siblings = await listAccessibleFlashcards(body.topic_id);
  const nextIndex = siblings.length + 1;
  const requestedIndex = body.index == null ? nextIndex : clampIndex(body.index, nextIndex);
  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from('flashcards')
    .insert({
      topic_id: body.topic_id,
      cloze_text: body.cloze_text,
      extra: body.extra || null,
      index: -(siblings.length + 1),
      created_by: (await userClient.rpc('current_tutor_id')).data ?? null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await persistTopicFlashcardOrder(
      serviceClient,
      body.topic_id,
      insertIdAtIndex(siblings.map((card) => card.id), data.id, requestedIndex),
    );
  } catch (orderError) {
    const message = orderError instanceof Error ? orderError.message : 'Unable to reorder flashcards';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
