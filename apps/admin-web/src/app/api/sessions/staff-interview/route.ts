import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { Database } from '@altitutor/shared';

const STAFF_INTERVIEW_DEFAULT_DURATION_MINUTES = 45;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUserStaff } = await supabase
      .from('staff')
      .select('id, role')
      .eq('user_id', user.id)
      .single<{ id: string; role: string }>();

    if (!currentUserStaff || currentUserStaff.role !== 'ADMINSTAFF') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      interviewee_staff_id: intervieweeStaffId,
      interviewer_staff_id: interviewerStaffId,
      start_at: startAt,
      end_at: endAt,
      duration_minutes: durationMinutes,
    } = body as {
      interviewee_staff_id?: string;
      interviewer_staff_id?: string;
      start_at?: string;
      end_at?: string;
      duration_minutes?: number;
    };

    if (!intervieweeStaffId || typeof intervieweeStaffId !== 'string') {
      return NextResponse.json(
        { error: 'interviewee_staff_id is required' },
        { status: 400 }
      );
    }

    if (!interviewerStaffId || typeof interviewerStaffId !== 'string') {
      return NextResponse.json(
        { error: 'interviewer_staff_id is required' },
        { status: 400 }
      );
    }

    if (intervieweeStaffId === interviewerStaffId) {
      return NextResponse.json(
        { error: 'Interviewee and interviewer must be different staff members' },
        { status: 400 }
      );
    }

    let resolvedStartAt: string;
    let resolvedEndAt: string;

    if (startAt && endAt) {
      resolvedStartAt = startAt;
      resolvedEndAt = endAt;
    } else if (startAt && (durationMinutes ?? STAFF_INTERVIEW_DEFAULT_DURATION_MINUTES)) {
      const start = new Date(startAt);
      const duration = durationMinutes ?? STAFF_INTERVIEW_DEFAULT_DURATION_MINUTES;
      const end = new Date(start.getTime() + duration * 60 * 1000);
      resolvedStartAt = start.toISOString();
      resolvedEndAt = end.toISOString();
    } else {
      return NextResponse.json(
        { error: 'start_at is required (end_at or duration_minutes optional)' },
        { status: 400 }
      );
    }

    const sessionInsert: Database['public']['Tables']['sessions']['Insert'] = {
      id: randomUUID(),
      type: 'STAFF_INTERVIEW',
      subject_id: null,
      start_at: resolvedStartAt,
      end_at: resolvedEndAt,
      status: 'ACTIVE',
    };

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert(sessionInsert)
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Failed to create staff interview session:', sessionError);
      return NextResponse.json(
        { error: sessionError?.message ?? 'Failed to create session' },
        { status: 500 }
      );
    }

    const sessionId = session.id;

    const staff1Insert: Database['public']['Tables']['sessions_staff']['Insert'] = {
      id: randomUUID(),
      session_id: sessionId,
      staff_id: intervieweeStaffId,
      type: 'TRIAL_TUTOR',
      created_by: currentUserStaff.id,
    };

    const { error: staff1Error } = await supabaseAdmin.from('sessions_staff').insert(staff1Insert);

    if (staff1Error) {
      await supabaseAdmin.from('sessions').delete().eq('id', sessionId);
      console.error('Failed to link interviewee:', staff1Error);
      return NextResponse.json(
        { error: staff1Error.message ?? 'Failed to link interviewee' },
        { status: 500 }
      );
    }

    const staff2Insert: Database['public']['Tables']['sessions_staff']['Insert'] = {
      id: randomUUID(),
      session_id: sessionId,
      staff_id: interviewerStaffId,
      type: 'MAIN_TUTOR',
      created_by: currentUserStaff.id,
    };

    const { error: staff2Error } = await supabaseAdmin.from('sessions_staff').insert(staff2Insert);

    if (staff2Error) {
      await supabaseAdmin.from('sessions_staff').delete().eq('session_id', sessionId);
      await supabaseAdmin.from('sessions').delete().eq('id', sessionId);
      console.error('Failed to link interviewer:', staff2Error);
      return NextResponse.json(
        { error: staff2Error.message ?? 'Failed to link interviewer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session_id: sessionId });
  } catch (error) {
    console.error('Staff interview creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
