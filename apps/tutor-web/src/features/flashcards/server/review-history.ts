import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function GET(request: NextRequest) {
  const subjectId = request.nextUrl.searchParams.get('subjectId');
  if (!subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });

  const client = createClient();
  const { data: claims } = await client.auth.getClaims();
  const { data: isTutor, error: tutorError } = await client.rpc('is_tutor');
  if (!claims?.claims?.sub || tutorError || !isTutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { data: history, error } = await client.from('vtutor_flashcard_review_history')
    .select('id,student_id,review_card_id,action,rating,answered_at,duration_ms,pre_state,post_state,undone_at,topic_id,subject_id')
    .eq('subject_id', subjectId)
    .order('answered_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = [...new Set((history ?? []).map((row) => row.student_id))];
  const { data: students, error: studentError } = studentIds.length
    ? await client.from('vtutor_students').select('id,first_name,last_name').in('id', studentIds).order('first_name')
    : { data: [], error: null };
  if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });

  return NextResponse.json({ data: { history: history ?? [], students: students ?? [] } }, { headers: { 'Cache-Control': 'private, no-store' } });
}
