import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

export async function GET() {
  const user=createClient(); const {data:claims}=await user.auth.getClaims();
  if(!claims?.claims?.sub) return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:studentId}=await user.rpc('current_student_id');
  if(!studentId) return NextResponse.json({error:'student_not_found'},{status:403});
  const {data,error}=await getServerSupabaseAdmin().from('student_flashcard_review_logs')
    .select('id,review_card_id,action,rating,answered_at,duration_ms,pre_state,post_state,undone_at')
    .eq('student_id',studentId).order('answered_at',{ascending:false}).limit(200);
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({data});
}
