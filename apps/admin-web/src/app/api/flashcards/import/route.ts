import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { parseFlashcardCsv } from '@altitutor/shared';

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await request.json();
  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });

  const { data: topic } = await userClient.from('topics').select('id').eq('id', body.topic_id).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });

  const parsed = parseFlashcardCsv(String(body.csv ?? ''));
  if (parsed.rows.length === 0) {
    return NextResponse.json({ data: { inserted: 0, rejected: parsed.rejected } }, { status: 400 });
  }

  const { data: siblings } = await supabaseAdmin
    .from('flashcards')
    .select('index')
    .eq('topic_id', body.topic_id)
    .is('deleted_at', null);
  const startIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;

  const rows = parsed.rows
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((row, offset) => ({
      topic_id: body.topic_id,
      cloze_text: row.clozeText,
      extra: row.extra,
      index: startIndex + offset,
    }));

  const { error } = await supabaseAdmin.from('flashcards').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { inserted: rows.length, rejected: parsed.rejected } });
}
