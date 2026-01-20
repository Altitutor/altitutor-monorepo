'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { notificationsKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook to subscribe to notifications changes in real-time
 * Note: Tutors receive notifications via staff_id, so we filter by staff_id
 */
export function useNotificationsRealtime(tutorStaffId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tutorStaffId) return;

    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `staff_id=eq.${tutorStaffId}`,
        },
        () => {
          // Invalidate notifications queries when new notification is inserted
          queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
          queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `staff_id=eq.${tutorStaffId}`,
        },
        () => {
          // Invalidate when read_at changes (notification marked as read)
          queryClient.invalidateQueries({ queryKey: notificationsKeys.notifications() });
          queryClient.invalidateQueries({ queryKey: notificationsKeys.unreadCount() });
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
  }, [tutorStaffId, queryClient]);
}
