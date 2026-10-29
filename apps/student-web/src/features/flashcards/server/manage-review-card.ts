import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFlashcardClient } from '@/features/flashcards/server/user-client';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const actions = ['forget','suspend','resume','bury','unbury'] as const;
type Action = typeof actions[number];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json() as { action?: unknown; requestId?: unknown };
  if (!actions.includes(body.action as Action) || typeof body.requestId !== 'string') return NextResponse.json({ error: 'Invalid management command' }, { status: 400 });
  const userClient = await authenticatedFlashcardClient(request);
  if (!userClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [{ data: studentId }, { data: card }] = await Promise.all([
    userClient.rpc('current_student_id'),
    userClient.from('vstudent_flashcard_review_cards').select('id').eq('id',params.id).maybeSingle(),
  ]);
  if (!studentId || !card) return NextResponse.json({ error: 'flashcard_review_card_not_accessible' }, { status: 404 });
  const admin = getServerSupabaseAdmin({ retry: false });
  const now = new Date();
  const { data: preferences } = await admin.from('student_flashcard_preferences').select('timezone').eq('student_id',studentId).maybeSingle();
  const { data: bounds } = await admin.rpc('flashcard_study_day_bounds',{p_now:now.toISOString(),p_timezone:preferences?.timezone ?? 'Australia/Adelaide'});
  const fingerprint=createHash('sha256').update(`${params.id}:${body.action}`).digest('hex');
  const { data, error }=await admin.rpc('manage_flashcard_review_card',{
    p_student_id:studentId,p_review_card_id:params.id,p_request_id:body.requestId,p_request_fingerprint:fingerprint,
    p_action:body.action as Action,p_now:now.toISOString(),p_buried_until:body.action==='bury' ? bounds?.[0]?.ends_at ?? undefined : undefined,
  });
  if(error) return NextResponse.json({error:error.message},{status:error.code==='PT409'||error.code==='40001'?409:500});
  const result = data as { reviewLogId: string };
  const [stateResult, historyResult] = await Promise.all([
    userClient.from('vstudent_flashcard_review_cards')
      .select('id,due_at,stability,difficulty,scheduled_days,learning_steps,reps,lapses,state,last_reviewed_at,last_rating,revision,buried_until,buried_reason,suspended_at,leech_at')
      .eq('id', params.id).single(),
    admin.from('student_flashcard_review_logs')
      .select('id,review_card_id,action,rating,answered_at,duration_ms,pre_state,post_state,undone_at')
      .eq('student_id', studentId).eq('id', result.reviewLogId).single(),
  ]);
  if (stateResult.error || historyResult.error) {
    // The command has committed. Older study clients only inspect response.ok;
    // keep that outcome successful even if the optional manager refresh fails.
    return NextResponse.json({ data: result });
  }
  return NextResponse.json({ data: { ...result, cardState: stateResult.data, historyEntry: historyResult.data } });
}
