import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  const userClient = createClient();
  const { data, error } = await userClient
    .from('vstudent_flashcard_topics')
    .select('*')
    .eq('topic_id', topicId)
    .maybeSingle();

  if (error) return captureApiErrorResponse(error, "/api/flashcards", NextResponse.json({ error: error.message }, { status: 500 }));
  return NextResponse.json({ data: data ?? null });
}
