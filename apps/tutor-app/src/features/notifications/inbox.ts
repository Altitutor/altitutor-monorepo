import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { tutorWebJson } from '@/lib/tutor-web';
import { useAuth } from '@/providers/auth-provider';

export const inboxQueryKey = (userId: string | undefined) => ['tutor-inbox', userId];

function visibleInbox() {
  return supabase.from('vtutor_notifications')
    .select('id, title, body, created_at, read_at, action_url')
    .eq('app_scope', 'staff_web')
    .is('dismissed_at', null)
    .is('resolved_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

export function useTutorInbox() {
  const { session } = useAuth();
  return useQuery({
    queryKey: inboxQueryKey(session?.user.id),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => {
      const { data, error } = await visibleInbox().abortSignal(signal)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data.flatMap(({ id, ...row }) => id ? [{ ...row, id }] : []);
    },
  });
}

export function useInboxItem(notificationId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...inboxQueryKey(session?.user.id), notificationId],
    enabled: Boolean(session && notificationId),
    queryFn: async ({ signal }) => {
      const { data, error } = await visibleInbox().abortSignal(signal)
        .eq('id', notificationId!).maybeSingle();
      if (error) throw error;
      return data?.id ? { ...data, id: data.id } : null;
    },
  });
}

export function updateInbox(userId: string, update: { notificationIds?: string[]; markAllRead?: boolean; dismiss?: boolean }) {
  return tutorWebJson('/api/notifications', 'PATCH', update, userId);
}
