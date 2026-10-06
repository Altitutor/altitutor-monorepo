'use client';

import { useEffect } from 'react';
import { useToast } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { notificationsKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook to subscribe to notifications changes in real-time
 */
export function useNotificationsRealtime(staffId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!staffId) return;

    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          const notification = payload.new as Database['public']['Tables']['notifications']['Row'];
          const actionUrl = notification.action_url;
          if (notification.notification_type === 'MESSAGE_DELIVERY_FAILED') {
            toast({
              title: notification.title,
              description: notification.body ?? undefined,
              variant: 'destructive',
              action: actionUrl ? {
                label: 'View message',
                onClick: () => router.push(actionUrl),
              } : undefined,
            });
          }
          if (queryClient.isMutating({ mutationKey: notificationsKeys.dismiss })) return;
          // Invalidate notifications queries when new notification is inserted
          queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
          queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `staff_id=eq.${staffId}`,
        },
        () => {
          if (queryClient.isMutating({ mutationKey: notificationsKeys.dismiss })) return;
          // Invalidate when read_at changes (notification marked as read)
          queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications(staffId) });
          queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount(staffId) });
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('[useNotificationsRealtime] Subscription error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, queryClient, toast, router]);
}
