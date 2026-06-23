import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId is required' }, { status: 400 });

  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from('vstudent_flashcard_collections')
    .select('*')
    .eq('topic_id', topicId)
    .order('index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
