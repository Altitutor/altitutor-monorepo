import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

async function student(){const user=createClient();const {data:claims}=await user.auth.getClaims();if(!claims?.claims?.sub)return null;const {data}=await user.rpc('current_student_id');return data;}
function validTimezone(value:string){try{new Intl.DateTimeFormat('en-AU',{timeZone:value}).format();return true;}catch{return false;}}

export async function GET(){const studentId=await student();if(!studentId)return NextResponse.json({error:'Unauthorized'},{status:401});const admin=getServerSupabaseAdmin();
  let {data}=await admin.from('student_flashcard_preferences').select('*').eq('student_id',studentId).maybeSingle();
  if(data?.pending_timezone&&data.pending_timezone_effective_at&&new Date(data.pending_timezone_effective_at)<=new Date()){
    const updated=await admin.from('student_flashcard_preferences').update({timezone:data.pending_timezone,pending_timezone:null,pending_timezone_effective_at:null,timezone_confirmed_at:new Date().toISOString()}).eq('student_id',studentId).select('*').single();data=updated.data;
  }
  return NextResponse.json({data:data??{student_id:studentId,new_cards_per_study_day:20,review_cards_per_study_day:200,timezone:'Australia/Adelaide',timezone_confirmed_at:null,pending_timezone:null,pending_timezone_effective_at:null}});
}
export async function PUT(request:NextRequest){const studentId=await student();if(!studentId)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json() as {newLimit?:unknown;reviewLimit?:unknown;timezone?:unknown};
  if(!Number.isInteger(body.newLimit)||!Number.isInteger(body.reviewLimit)||(body.newLimit as number)<0||(body.newLimit as number)>9999||(body.reviewLimit as number)<0||(body.reviewLimit as number)>9999||typeof body.timezone!=='string'||!validTimezone(body.timezone)) return NextResponse.json({error:'Invalid preferences'},{status:400});
  const admin=getServerSupabaseAdmin();const now=new Date();const {data:existing}=await admin.from('student_flashcard_preferences').select('*').eq('student_id',studentId).maybeSingle();
  const currentTimezone=existing?.timezone??'Australia/Adelaide';const timezoneChanged=currentTimezone!==body.timezone;
  const {data:bounds}=await admin.rpc('flashcard_study_day_bounds',{p_now:now.toISOString(),p_timezone:currentTimezone});
  const values={student_id:studentId,new_cards_per_study_day:body.newLimit as number,review_cards_per_study_day:body.reviewLimit as number,
    timezone:currentTimezone,timezone_confirmed_at:now.toISOString(),
    pending_timezone:timezoneChanged?body.timezone:existing?.pending_timezone??null,
    pending_timezone_effective_at:timezoneChanged?bounds?.[0]?.ends_at??now.toISOString():existing?.pending_timezone_effective_at??null,updated_at:now.toISOString()};
  const {data,error}=await admin.from('student_flashcard_preferences').upsert(values).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({data});
}
