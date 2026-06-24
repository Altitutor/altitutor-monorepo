import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

async function assertTopicAccess(topicId: string) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return false;
  const { data } = await userClient.from('topics').select('id').eq('id', topicId).maybeSingle();
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const body = await request.json();
  const topicId = String(body.topic_id ?? '');
  const orderedIds: string[] = Array.isArray(body.card_ids) ? body.card_ids.map((id: unknown) => String(id)) : [];

  if (!topicId) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
  if (orderedIds.length === 0) return NextResponse.json({ error: 'card_ids is required' }, { status: 400 });
  if (!(await assertTopicAccess(topicId))) {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }

  const { data: cards, error: cardsError } = await supabaseAdmin
    .from('flashcards')
    .select('id')
    .eq('topic_id', topicId)
    .is('deleted_at', null);

  if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

  const existingIds = new Set<string>((cards ?? []).map((card) => String(card.id)));
  const uniqueOrderedIds: string[] = Array.from(new Set<string>(orderedIds)).filter((id) => existingIds.has(id));
  if (uniqueOrderedIds.length !== existingIds.size) {
    return NextResponse.json({ error: 'card_ids must include every flashcard in the topic exactly once' }, { status: 400 });
  }

  for (const [idx, id] of uniqueOrderedIds.entries()) {
    const { error } = await supabaseAdmin
      .from('flashcards')
      .update({ index: idx + 1, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { updated: uniqueOrderedIds.length } });
}
