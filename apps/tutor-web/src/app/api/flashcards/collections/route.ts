import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  const userClient = createClient() as any;
  const { data, error } = await userClient
    .from('vstaff_flashcard_collections')
    .select('*')
    .eq('topic_id', topicId)
    .order('index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userClient = createClient() as any;

  const { data: isTutor } = await userClient.rpc('is_tutor');
  if (!isTutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const { data: topic } = await userClient
    .from('vtutor_topics')
    .select('id')
    .eq('id', body.topic_id)
    .maybeSingle();

  if (!topic) return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });

  const serviceClient = getServiceRoleClient() as any;
  const { data: siblings } = await serviceClient
    .from('flashcard_collections')
    .select('index')
    .eq('topic_id', body.topic_id)
    .is('deleted_at', null);

  const nextIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;
  const { data, error } = await serviceClient
    .from('flashcard_collections')
    .insert({
      topic_id: body.topic_id,
      title: body.title,
      description: body.description || null,
      index: body.index ?? nextIndex,
      created_by: staffId ?? null,
      updated_by: staffId ?? null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
