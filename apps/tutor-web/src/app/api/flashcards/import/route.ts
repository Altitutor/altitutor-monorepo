import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { parseFlashcardCsv } from '@altitutor/shared';
import { listAccessibleFlashcards } from '../_lib';

export async function POST(request: NextRequest) {
  const userClient = createClient();
  const { data: isTutor } = await userClient.rpc('is_tutor');
  if (!isTutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await request.json();
  if (!body.topic_id) return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });

  let siblings;
  try {
    siblings = await listAccessibleFlashcards(body.topic_id);
  } catch {
    return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });
  }

  const parsed = parseFlashcardCsv(String(body.csv ?? ''));
  if (parsed.rows.length === 0) {
    return NextResponse.json({ data: { inserted: 0, rejected: parsed.rejected } }, { status: 400 });
  }

  const startIndex = Math.max(0, ...siblings.map((card) => card.index ?? 0)) + 1;

  const rows = parsed.rows
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((row, offset) => ({
      topic_id: body.topic_id,
      cloze_text: row.clozeText,
      extra: row.extra,
      index: startIndex + offset,
    }));

  const serviceClient = getServiceRoleClient();
  const { error } = await serviceClient.from('flashcards').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { inserted: rows.length, rejected: parsed.rejected } });
}
