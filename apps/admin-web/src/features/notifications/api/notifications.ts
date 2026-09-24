import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_NOTIFICATIONS = 50;

function inboxExpiryFilter(now: string) {
  return `expires_at.is.null,expires_at.gt.${now}`;
}

/**
 * Notifications API client
 */
export const notificationsApi = {
  /**
   * Get visible inbox notifications for a staff member
   */
  getNotifications: async (staffId: string): Promise<Tables<'notifications'>[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('staff_id', staffId)
      .is('dismissed_at', null)
      .is('resolved_at', null)
      .or(inboxExpiryFilter(now))
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS);

    if (error) throw error;
    return (data ?? []) as Tables<'notifications'>[];
  },

  /**
   * Get unread count for a staff member
   */
  getUnreadCount: async (staffId: string): Promise<number> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .is('read_at', null)
      .is('dismissed_at', null)
      .is('resolved_at', null)
      .or(inboxExpiryFilter(now));

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Mark notification as read
   */
  markNotificationRead: async (notificationId: string, staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('id', notificationId)
      .eq('staff_id', staffId)
      .is('read_at', null);

    if (error) throw error;
  },

  /**
   * Mark all visible unread notifications as read
   */
  markAllNotificationsRead: async (staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('staff_id', staffId)
      .is('read_at', null)
      .is('dismissed_at', null)
      .is('resolved_at', null);

    if (error) throw error;
  },

  /**
   * Dismiss a notification from the inbox
   */
  dismissNotification: async (notificationId: string, staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { error: dismissError } = await supabase
      .from('notifications')
      .update({ dismissed_at: now, updated_at: now })
      .eq('id', notificationId)
      .eq('staff_id', staffId)
      .is('dismissed_at', null);

    if (dismissError) throw dismissError;

    const { error: readError } = await supabase
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('id', notificationId)
      .eq('staff_id', staffId)
      .is('read_at', null);

    if (readError) throw readError;
  },
};
