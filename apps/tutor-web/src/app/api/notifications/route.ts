import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';

type MarkReadBody = {
  notificationIds?: string[];
};

type NotificationIdRow = {
  id: string | null;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MarkReadBody;
    const notificationIds = Array.from(new Set(body.notificationIds ?? [])).filter(Boolean);

    if (notificationIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const userClient = createClient();
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');

    if (tutorCheckError) {
      console.error('Error checking tutor status:', tutorCheckError);
      return NextResponse.json({ error: 'Failed to verify tutor status' }, { status: 500 });
    }

    if (!isTutor) {
      return NextResponse.json({ error: 'Unauthorized: User is not a tutor' }, { status: 403 });
    }

    const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id');

    if (tutorIdError || !tutorId) {
      console.error('Error getting tutor ID:', tutorIdError);
      return NextResponse.json({ error: 'Failed to get tutor ID' }, { status: 500 });
    }

    const { data: visibleNotifications, error: noteError } = await userClient
      .from('vtutor_notifications')
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

    const { error } = await getServiceRoleClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('staff_id', tutorId)
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
