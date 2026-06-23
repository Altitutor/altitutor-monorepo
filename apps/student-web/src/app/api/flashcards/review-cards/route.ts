import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  const mode = request.nextUrl.searchParams.get('mode') === 'all' ? 'all' : 'due';

  const userClient = createClient();
  let query = userClient
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .order('flashcard_index', { ascending: true })
    .order('cloze_index', { ascending: true });

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  if (mode === 'due') {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    query = query.lte('due_at', endOfToday.toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
