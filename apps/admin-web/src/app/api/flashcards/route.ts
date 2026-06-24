import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { hasClozeMarker } from '@altitutor/shared';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const body = await request.json();
  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
  if (!(await assertTopicAccess(body.topic_id))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }
  if (!hasClozeMarker(body.cloze_text ?? '')) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }

  const { data: siblings } = await supabaseAdmin
    .from('flashcards')
    .select('id,index')
    .eq('topic_id', body.topic_id)
    .is('deleted_at', null);

  const nextIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;
  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .insert({
      topic_id: body.topic_id,
      cloze_text: body.cloze_text,
      extra: body.extra || null,
      index: nextIndex,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.index !== undefined) {
    const targetIndexRaw = Number(body.index);
    const targetIndex = Math.min(
      Math.max(Number.isFinite(targetIndexRaw) ? Math.trunc(targetIndexRaw) : nextIndex, 1),
      nextIndex,
    );
    const ordered = [...(siblings ?? []).sort((a, b) => a.index - b.index), data];
    const withoutNew = ordered.filter((card) => card.id !== data.id);
    withoutNew.splice(targetIndex - 1, 0, data);

    for (const [idx, card] of withoutNew.entries()) {
      const { error: updateError } = await supabaseAdmin
        .from('flashcards')
        .update({ index: idx + 1, updated_at: new Date().toISOString() })
        .eq('id', card.id);

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: reordered, error: reorderFetchError } = await supabaseAdmin
      .from('flashcards')
      .select('*')
      .eq('id', data.id)
      .single();

    if (reorderFetchError) return NextResponse.json({ error: reorderFetchError.message }, { status: 500 });
    return NextResponse.json({ data: reordered });
  }

  return NextResponse.json({ data });
}
