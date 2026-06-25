import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

type MarkReadBody = {
  notificationIds?: string[];
};

type NotificationIdRow = {
  id: string | null;
};

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MarkReadBody;
    const notificationIds = Array.from(new Set(body.notificationIds ?? [])).filter(Boolean);

    if (notificationIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const userClient = createServerClient();
    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');

    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json({ error: 'Failed to verify student status' }, { status: 500 });
    }

    if (!isStudent) {
      return NextResponse.json({ error: 'Unauthorized: User is not a student' }, { status: 403 });
    }

    const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');

    if (studentIdError || !studentId) {
      console.error('Error getting student ID:', studentIdError);
      return NextResponse.json({ error: 'Failed to get student ID' }, { status: 500 });
    }

    const { data: visibleNotifications, error: noteError } = await userClient
      .from('vstudent_notifications')
      .select('id')
      .in('id', notificationIds);

    if (noteError) {
      console.error('Error checking notifications:', noteError);
      return NextResponse.json({ error: 'Failed to verify notifications' }, { status: 500 });
    }

    const visibleIds = ((visibleNotifications ?? []) as NotificationIdRow[])
      .map((notification) => notification.id)
      .filter((id): id is string => Boolean(id));

    if (visibleIds.length !== notificationIds.length) {
      return NextResponse.json(
        { error: 'One or more notifications were not found or do not belong to you' },
        { status: 404 }
      );
    }

    const { error } = await createServiceClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .in('id', visibleIds)
      .is('read_at', null);

    if (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: visibleIds.length });
  } catch (error) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
