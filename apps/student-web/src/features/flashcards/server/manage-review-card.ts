import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const actions = ['forget','suspend','resume','bury','unbury'] as const;
type Action = typeof actions[number];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json() as { action?: unknown; requestId?: unknown };
  if (!actions.includes(body.action as Action) || typeof body.requestId !== 'string') return NextResponse.json({ error: 'Invalid management command' }, { status: 400 });
  const userClient = createClient();
  const { data: claims } = await userClient.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [{ data: studentId }, { data: card }] = await Promise.all([
    userClient.rpc('current_student_id'),
    userClient.from('vstudent_flashcard_review_cards').select('id').eq('id',params.id).maybeSingle(),
  ]);
  if (!studentId || !card) return NextResponse.json({ error: 'flashcard_review_card_not_accessible' }, { status: 404 });
  const admin = getServerSupabaseAdmin();
  const now = new Date();
  const { data: preferences } = await admin.from('student_flashcard_preferences').select('timezone').eq('student_id',studentId).maybeSingle();
  const { data: bounds } = await admin.rpc('flashcard_study_day_bounds',{p_now:now.toISOString(),p_timezone:preferences?.timezone ?? 'Australia/Adelaide'});
  const fingerprint=createHash('sha256').update(`${params.id}:${body.action}`).digest('hex');
  const { data, error }=await admin.rpc('manage_flashcard_review_card',{
    p_student_id:studentId,p_review_card_id:params.id,p_request_id:body.requestId,p_request_fingerprint:fingerprint,
    p_action:body.action as Action,p_now:now.toISOString(),p_buried_until:body.action==='bury' ? bounds?.[0]?.ends_at ?? undefined : undefined,
  });
  if(error) return NextResponse.json({error:error.message},{status:error.code==='40001'?409:500});
  return NextResponse.json({data});
}
