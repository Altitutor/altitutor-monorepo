import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const uuid = z.string().guid();
const sendSchema = z.object({messageId:uuid,contactId:uuid,destination:z.string().min(1).max(30),expectedRecoveryId:uuid.nullable()});
async function actor() {
  const client = await createClient();
  const {data:{user},error} = await client.auth.getUser();
  if(error || !user) return {response:NextResponse.json({error:'Sign in required'},{status:401})};
  const {data:allowed,error:accessError} = await client.rpc('is_adminstaff_active');
  if(accessError || !allowed) return {response:NextResponse.json({error:'Active admin access required'},{status:403})};
  const {data:staff,error:staffError} = await client.from('staff').select('id').eq('user_id',user.id).maybeSingle();
  if(staffError || !staff) return {response:NextResponse.json({error:'Staff record not found'},{status:403})};
  return {staffId:staff.id};
}
export async function GET(request:NextRequest) {
  const auth = await actor();
  if(auth.response) return auth.response;
  const id = uuid.safeParse(request.nextUrl.searchParams.get('message'));
  if(!id.success) return NextResponse.json({error:'Invalid message'},{status:400});
  const admin = getServerSupabaseAdmin();
  const [{data,error},{data:delivery,error:deliveryError}] = await Promise.all([
    admin.rpc('preview_automation_message_recovery',{p_message_id:id.data}),
    admin.from('automation_message_deliveries').select('recipient_student_id,recipient_parent_id').eq('message_id',id.data).maybeSingle(),
  ]);
  if(error || deliveryError || !data || typeof data !== 'object' || Array.isArray(data)) return NextResponse.json({error:'This delivery cannot be recovered. Refresh the conversation.'},{status:409});
  const recipientPath = delivery?.recipient_student_id ? `/students/${delivery.recipient_student_id}` : delivery?.recipient_parent_id ? `/parents/${delivery.recipient_parent_id}` : null;
  return NextResponse.json({...data,recipientPath},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest) {
  const auth = await actor();
  if(auth.response) return auth.response;
  const parsed = sendSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:'Invalid recovery request'},{status:400});
  const body = parsed.data;
  const admin = getServerSupabaseAdmin();
  const {data,error} = await admin.rpc('prepare_automation_message_recovery',{
    p_message_id:body.messageId,p_staff_id:auth.staffId,p_contact_id:body.contactId,
    p_destination:body.destination,p_expected_recovery_id:body.expectedRecoveryId ?? undefined,
  });
  if(error) return NextResponse.json({error:error.message},{status:409});
  const result = z.object({messageId:uuid,created:z.boolean()}).safeParse(data);
  if(!result.success) return NextResponse.json({error:'Recovery result unavailable. Refresh before retrying.'},{status:500});
  // The service RPC claims a recovery message once, including on route retries.
  const {error:dispatchError} = await admin.functions.invoke('send-message',{body:{messageId:result.data.messageId}});
  if(dispatchError) return NextResponse.json({error:'Recovery could not be confirmed. Refresh and review its current outcome before trying again.'},{status:502});
  return NextResponse.json({messageId:result.data.messageId},{headers:{'Cache-Control':'no-store'}});
}
