import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { hasClozeMarker } from '@altitutor/shared';

async function assertTopicAccess(topicId: string) {
  const userClient = createClient();
  const { data: isTutor } = await userClient.rpc('is_tutor');
  if (!isTutor) return false;
  const { data } = await userClient.from('vtutor_topics').select('id').eq('id', topicId).maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from('vstaff_flashcards')
    .select('*')
    .eq('topic_id', topicId)
    .order('index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userClient = createClient();

  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
  if (!(await assertTopicAccess(body.topic_id))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }
  if (!hasClozeMarker(body.cloze_text ?? '')) {
    return NextResponse.json({ error: 'Flashcard text must contain a cloze marker' }, { status: 400 });
  }

  const { data: siblings } = await userClient
    .from('flashcards')
    .select('index')
    .eq('topic_id', body.topic_id)
    .is('deleted_at', null);

  const nextIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;
  const serviceClient = getServiceRoleClient();
  const { data, error } = await serviceClient
    .from('flashcards')
    .insert({
      topic_id: body.topic_id,
      cloze_text: body.cloze_text,
      extra: body.extra || null,
      index: body.index ?? nextIndex,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
