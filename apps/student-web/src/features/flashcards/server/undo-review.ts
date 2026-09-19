import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

export async function POST(request:NextRequest){
  const body=await request.json() as {requestId?:unknown};
  if(typeof body.requestId!=='string') return NextResponse.json({error:'Invalid undo command'},{status:400});
  const user=createClient(); const {data:claims}=await user.auth.getClaims();
  if(!claims?.claims?.sub) return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:studentId}=await user.rpc('current_student_id');
  if(!studentId) return NextResponse.json({error:'student_not_found'},{status:403});
  const {data,error}=await getServerSupabaseAdmin().rpc('undo_latest_flashcard_answer',{
    p_student_id:studentId,p_request_id:body.requestId,p_request_fingerprint:'undo-latest',
  });
  if(error) return NextResponse.json({error:error.message},{status:error.code==='40001'?409:400});
  return NextResponse.json({data});
}
