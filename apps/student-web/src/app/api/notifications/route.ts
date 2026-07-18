import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

const MAX_NOTIFICATIONS = 50;

type NotificationPatchBody = {
  notificationIds?: string[];
  markAllRead?: boolean;
  dismiss?: boolean;
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

async function resolveStudentContext() {
  const userClient = createServerClient();
  const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');

  if (studentCheckError) {
    console.error('Error checking student status:', studentCheckError);
    captureApiError(studentCheckError, "/api/notifications");
    return {
      response: NextResponse.json({ error: 'Failed to verify student status' }, { status: 500 }),
    } as const;
  }

  if (!isStudent) {
    return {
      response: NextResponse.json({ error: 'Unauthorized: User is not a student' }, { status: 403 }),
    } as const;
  }

  const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');

  if (studentIdError || !studentId) {
    console.error('Error getting student ID:', studentIdError);
    captureApiError(studentIdError, "/api/notifications");
    return {
      response: NextResponse.json({ error: 'Failed to get student ID' }, { status: 500 }),
    } as const;
  }

  return { userClient, studentId } as const;
}

async function verifyNotificationIds(
  userClient: ReturnType<typeof createServerClient>,
  notificationIds: string[],
) {
  const { data: visibleNotifications, error: noteError } = await userClient
    .from('vstudent_notifications')
    .select('id')
    .in('id', notificationIds);

  if (noteError) {
    console.error('Error checking notifications:', noteError);
    captureApiError(noteError, "/api/notifications");
    return {
      response: NextResponse.json({ error: 'Failed to verify notifications' }, { status: 500 }),
    } as const;
  }

  const visibleIds = ((visibleNotifications ?? []) as NotificationIdRow[])
    .map((notification) => notification.id)
    .filter((id): id is string => Boolean(id));

  if (visibleIds.length !== notificationIds.length) {
    return {
      response: NextResponse.json(
        { error: 'One or more notifications were not found or do not belong to you' },
        { status: 404 },
      ),
    } as const;
  }

  return { visibleIds } as const;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as NotificationPatchBody;
    const notificationIds = Array.from(new Set(body.notificationIds ?? [])).filter(Boolean);

    if (!body.markAllRead && notificationIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const resolved = await resolveStudentContext();
    if ('response' in resolved) return resolved.response;

    const { userClient, studentId } = resolved;
    const serviceClient = createServiceClient();
    const now = new Date().toISOString();

    if (body.dismiss) {
      if (body.markAllRead) {
        return NextResponse.json({ error: 'Cannot dismiss all notifications' }, { status: 400 });
      }

      const verified = await verifyNotificationIds(userClient, notificationIds);
      if ('response' in verified) return verified.response;

      const { error: dismissError } = await serviceClient
        .from('notifications')
        .update({ dismissed_at: now, updated_at: now })
        .eq('student_id', studentId)
        .in('id', verified.visibleIds)
        .is('dismissed_at', null);

      if (dismissError) {
        console.error('Error dismissing notifications:', dismissError);
        captureApiError(dismissError, "/api/notifications");
        return NextResponse.json({ error: 'Failed to dismiss notifications' }, { status: 500 });
      }

      const { error: readError } = await serviceClient
        .from('notifications')
        .update({ read_at: now, updated_at: now })
        .eq('student_id', studentId)
        .in('id', verified.visibleIds)
        .is('read_at', null);

      if (readError) {
        console.error('Error marking dismissed notifications as read:', readError);
        captureApiError(readError, "/api/notifications");
        return NextResponse.json({ error: 'Failed to dismiss notifications' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: verified.visibleIds.length });
    }

    let update = serviceClient
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('student_id', studentId)
      .is('read_at', null)
      .is('dismissed_at', null)
      .is('resolved_at', null);

    if (!body.markAllRead) {
      const verified = await verifyNotificationIds(userClient, notificationIds);
      if ('response' in verified) return verified.response;
      update = update.in('id', verified.visibleIds.slice(0, MAX_NOTIFICATIONS));
    }

    const { error } = await update;
    if (error) {
      console.error('Error updating notifications:', error);
      captureApiError(error, "/api/notifications");
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, "/api/notifications");
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
