import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const mode = request.nextUrl.searchParams.get('mode') === 'all' ? 'all' : 'due';
  const supabase = createClient() as any;
  let query = supabase
    .from('vstudent_flashcard_review_cards')
    .select('*')
    .eq('collection_id', params.id)
    .order('flashcard_index', { ascending: true })
    .order('cloze_index', { ascending: true });

  if (mode === 'due') {
    query = query.lte('due_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
