import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { parseFlashcardCsv } from '@altitutor/shared';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const userClient = createClient() as any;
  const { data: collection } = await userClient
    .from('vstaff_flashcard_collections')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();

  if (!collection) return NextResponse.json({ error: 'Collection not accessible' }, { status: 403 });

  const parsed = parseFlashcardCsv(String(body.csv ?? ''));
  if (parsed.rows.length === 0) {
    return NextResponse.json({ data: { inserted: 0, rejected: parsed.rejected } }, { status: 400 });
  }

  const { data: staffId } = await userClient.rpc('current_tutor_id');
  const serviceClient = getServiceRoleClient() as any;
  const { data: siblings } = await serviceClient
    .from('flashcards')
    .select('index')
    .eq('collection_id', params.id)
    .is('deleted_at', null);
  const startIndex = Math.max(0, ...(siblings ?? []).map((row: { index: number }) => row.index)) + 1;

  const rows = parsed.rows
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .map((row, offset) => ({
      collection_id: params.id,
      title: row.title,
      cloze_text: row.clozeText,
      extra: row.extra,
      index: startIndex + offset,
      created_by: staffId ?? null,
      updated_by: staffId ?? null,
    }));

  const { error } = await serviceClient.from('flashcards').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { inserted: rows.length, rejected: parsed.rejected } });
}
