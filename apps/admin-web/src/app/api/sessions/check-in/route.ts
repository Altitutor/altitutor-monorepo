import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { Database } from '@altitutor/shared';
import { CHECK_IN_HOST, CHECK_IN_RECEIVER } from '@altitutor/shared/pay-tiers';

type SessionsStaffType = Database['public']['Tables']['sessions_staff']['Insert']['type'];

function uniqueIds(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const admin = supabaseAdmin;

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
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      session_type: sessionTypeRaw,
      start_at: startAt,
      end_at: endAt,
      staff_ids: staffIds,
      check_in_staff: checkInStaff,
      student_ids: studentIds,
      parent_ids: parentIds,
    } = body as {
      session_type?: Database['public']['Enums']['session_type'];
      start_at?: string;
      end_at?: string;
      staff_ids?: string[];
      check_in_staff?: { host_ids?: string[]; receiver_ids?: string[] };
      student_ids?: string[];
      parent_ids?: string[];
    };

    const sessionType =
      sessionTypeRaw === 'ADMIN_MEETING' ? 'ADMIN_MEETING' : 'CHECK_IN';

    if (!startAt || !endAt) {
      return NextResponse.json({ error: 'start_at and end_at are required' }, { status: 400 });
    }

    const studentList = uniqueIds(studentIds);
    const parentList = uniqueIds(parentIds);

    let hostIds = uniqueIds(checkInStaff?.host_ids);
    let receiverIds = uniqueIds(checkInStaff?.receiver_ids);
    const legacyStaffList = uniqueIds(staffIds);

    if (sessionType === 'CHECK_IN') {
      if (hostIds.length === 0 && receiverIds.length === 0 && legacyStaffList.length > 0) {
        receiverIds = [legacyStaffList[0]!];
        hostIds = legacyStaffList.slice(1);
      }
      if (receiverIds.length === 0) {
        return NextResponse.json(
          { error: 'At least one receiving staff member is required for a check-in' },
          { status: 400 }
        );
      }
      const overlap = hostIds.filter((id) => receiverIds.includes(id));
      if (overlap.length > 0) {
        return NextResponse.json(
          { error: 'A staff member cannot be both conducting and receiving on the same check-in' },
          { status: 400 }
        );
      }
    } else if (legacyStaffList.length === 0) {
      return NextResponse.json({ error: 'At least one staff member is required' }, { status: 400 });
    }

    const sessionInsert: Database['public']['Tables']['sessions']['Insert'] = {
      id: randomUUID(),
      type: sessionType,
      subject_id: null,
      class_id: null,
      start_at: startAt,
      end_at: endAt,
      status: 'ACTIVE',
    };

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .insert(sessionInsert)
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Failed to create meeting session:', sessionError);
      return NextResponse.json(
        { error: sessionError?.message ?? 'Failed to create session' },
        { status: 500 }
      );
    }

    const sessionId = session.id;

    const rollback = async () => {
      await admin.from('sessions').delete().eq('id', sessionId);
    };

    const staffRows: Array<{ staff_id: string; type: SessionsStaffType }> =
      sessionType === 'CHECK_IN'
        ? [
            ...hostIds.map((staff_id) => ({ staff_id, type: CHECK_IN_HOST as SessionsStaffType })),
            ...receiverIds.map((staff_id) => ({
              staff_id,
              type: CHECK_IN_RECEIVER as SessionsStaffType,
            })),
          ]
        : legacyStaffList.map((staff_id, i) => ({
            staff_id,
            type: (i === 0 ? 'MAIN_TUTOR' : 'SECONDARY_TUTOR') as SessionsStaffType,
          }));

    for (const { staff_id: staffId, type } of staffRows) {
      const row: Database['public']['Tables']['sessions_staff']['Insert'] = {
        id: randomUUID(),
        session_id: sessionId,
        staff_id: staffId,
        type,
        created_by: currentUserStaff.id,
      };
      const { error } = await admin.from('sessions_staff').insert(row);
      if (error) {
        await rollback();
        return NextResponse.json({ error: error.message ?? 'Failed to link staff' }, { status: 500 });
      }
    }

    for (const studentId of studentList) {
      const row: Database['public']['Tables']['sessions_students']['Insert'] = {
        id: randomUUID(),
        session_id: sessionId,
        student_id: studentId,
        created_by: currentUserStaff.id,
      };
      const { error } = await admin.from('sessions_students').insert(row);
      if (error) {
        await admin.from('sessions_staff').delete().eq('session_id', sessionId);
        await rollback();
        return NextResponse.json({ error: error.message ?? 'Failed to link student' }, { status: 500 });
      }
    }

    for (const parentId of parentList) {
      const row: Database['public']['Tables']['sessions_parents']['Insert'] = {
        id: randomUUID(),
        session_id: sessionId,
        parent_id: parentId,
        created_by: currentUserStaff.id,
      };
      const { error } = await admin.from('sessions_parents').insert(row);
      if (error) {
        await admin.from('sessions_students').delete().eq('session_id', sessionId);
        await admin.from('sessions_staff').delete().eq('session_id', sessionId);
        await rollback();
        return NextResponse.json({ error: error.message ?? 'Failed to link parent' }, { status: 500 });
      }
    }

    return NextResponse.json({ session_id: sessionId });
  } catch (error) {
    console.error('Meeting session creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
