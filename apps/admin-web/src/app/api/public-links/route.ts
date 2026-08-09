import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { getBookingConfirmationUrl, getInviteUrlForStudent } from '@/shared/utils/invites';

type PublicLinkPurpose = 'registration' | 'booking';

async function handle(request: NextRequest, rotate: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('user_id', user.id)
    .single<{ id: string; role: string }>();

  if (!staff || !['ADMINSTAFF', 'OFFICE_ADMIN'].includes(staff.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = (await request.json()) as { purpose?: PublicLinkPurpose; id?: string };
  if (!body.id || !body.purpose) {
    return NextResponse.json({ error: 'purpose and id are required' }, { status: 400 });
  }

  const functionName = body.purpose === 'registration'
    ? rotate
      ? 'rotate_student_registration_public_token'
      : 'issue_student_registration_public_token'
    : rotate
      ? 'rotate_session_booking_public_token'
      : 'issue_session_booking_public_token';
  const args = body.purpose === 'registration'
    ? rotate
      ? { p_student_id: body.id, p_performed_by: staff.id }
      : { p_student_id: body.id }
    : rotate
      ? { p_session_id: body.id, p_performed_by: staff.id }
      : { p_session_id: body.id };

  const { data: token, error } = await supabaseAdmin.rpc(functionName, args);
  if (error || typeof token !== 'string') {
    return NextResponse.json(
      { error: error?.message || 'Failed to issue public link' },
      { status: 400 }
    );
  }

  const url = body.purpose === 'registration'
    ? getInviteUrlForStudent(token, 'register')
    : getBookingConfirmationUrl(token);
  return NextResponse.json({ token, url });
}

export function POST(request: NextRequest) {
  return handle(request, false);
}

export function PUT(request: NextRequest) {
  return handle(request, true);
}
