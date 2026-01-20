import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notification } from '../types';

/**
 * Notifications API client
 */
export const notificationsApi = {
  /**
   * Get unread notifications for current student (via vstudent_notifications view)
   */
  getNotifications: async (): Promise<Notification[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('vstudent_notifications')
      .select('*')
      .is('read_at', null) // Only unread
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Notification[];
  },

  /**
   * Get unread count for current student
   */
  getUnreadCount: async (): Promise<number> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { count, error } = await supabase
      .from('vstudent_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Mark notification as read (calls API route)
   */
  markNotificationRead: async (notificationId: string): Promise<void> => {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark notification as read' }));
      throw new Error(error.error || 'Failed to mark notification as read');
    }
  },
};
