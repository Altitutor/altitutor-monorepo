import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';

const MAX_NOTIFICATIONS = 50;

type NotificationPatchBody = {
  notificationIds?: string[];
  markAllRead?: boolean;
  dismiss?: boolean;
};

type NotificationIdRow = {
  id: string | null;
};

async function resolveTutorContext() {
  const userClient = createClient();
  const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');

  if (tutorCheckError) {
    console.error('Error checking tutor status:', tutorCheckError);
    return {
      response: NextResponse.json({ error: 'Failed to verify tutor status' }, { status: 500 }),
    } as const;
  }

  if (!isTutor) {
    return {
      response: NextResponse.json({ error: 'Unauthorized: User is not a tutor' }, { status: 403 }),
    } as const;
  }

  const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id');

  if (tutorIdError || !tutorId) {
    console.error('Error getting tutor ID:', tutorIdError);
    return {
      response: NextResponse.json({ error: 'Failed to get tutor ID' }, { status: 500 }),
    } as const;
  }

  return { userClient, tutorId } as const;
}

async function verifyNotificationIds(
  userClient: ReturnType<typeof createClient>,
  notificationIds: string[],
) {
  const { data: visibleNotifications, error: noteError } = await userClient
    .from('vtutor_notifications')
    .select('id')
    .in('id', notificationIds);

  if (noteError) {
    console.error('Error checking notifications:', noteError);
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

    const resolved = await resolveTutorContext();
    if ('response' in resolved) return resolved.response;

    const { userClient, tutorId } = resolved;
    const serviceClient = getServiceRoleClient();
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
        .eq('staff_id', tutorId)
        .in('id', verified.visibleIds)
        .is('dismissed_at', null);

      if (dismissError) {
        console.error('Error dismissing notifications:', dismissError);
        return NextResponse.json({ error: 'Failed to dismiss notifications' }, { status: 500 });
      }

      const { error: readError } = await serviceClient
        .from('notifications')
        .update({ read_at: now, updated_at: now })
        .eq('staff_id', tutorId)
        .in('id', verified.visibleIds)
        .is('read_at', null);

      if (readError) {
        console.error('Error marking dismissed notifications as read:', readError);
        return NextResponse.json({ error: 'Failed to dismiss notifications' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: verified.visibleIds.length });
    }

    let update = serviceClient
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('staff_id', tutorId)
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
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
