'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { notificationsKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook to subscribe to notifications changes in real-time
 * Note: Students receive notifications via student_id, so we filter by student_id
 */
export function useNotificationsRealtime(studentId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `student_id=eq.${studentId}`,
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
          filter: `student_id=eq.${studentId}`,
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
  }, [studentId, queryClient]);
}
