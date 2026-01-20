import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notifications API client
 */
export const notificationsApi = {
  /**
   * Get unread notifications for a staff member
   */
  getNotifications: async (staffId: string): Promise<Tables<'notifications'>[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('staff_id', staffId)
      .is('read_at', null) // Only unread
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Tables<'notifications'>[];
  },

  /**
   * Get unread count for a staff member
   */
  getUnreadCount: async (staffId: string): Promise<number> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .is('read_at', null);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Mark notification as read
   */
  markNotificationRead: async (notificationId: string, staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('staff_id', staffId); // Ensure user can only mark their own

    if (error) throw error;
  },
};
