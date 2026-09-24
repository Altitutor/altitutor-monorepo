import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notification } from '../types';

const MAX_NOTIFICATIONS = 50;

function inboxExpiryFilter(now: string) {
  return `expires_at.is.null,expires_at.gt.${now}`;
}

/**
 * Notifications API client
 */
export const notificationsApi = {
  /**
   * Get visible inbox notifications for current tutor
   */
  getNotifications: async (): Promise<Notification[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('vtutor_notifications')
      .select('*')
      .is('dismissed_at', null)
      .is('resolved_at', null)
      .or(inboxExpiryFilter(now))
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS);

    if (error) throw error;
    return (data ?? []) as Notification[];
  },

  /**
   * Get unread count for current tutor
   */
  getUnreadCount: async (): Promise<number> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const now = new Date().toISOString();

    const { count, error } = await supabase
      .from('vtutor_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
      .is('dismissed_at', null)
      .is('resolved_at', null)
      .or(inboxExpiryFilter(now));

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
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark notification as read' }));
      throw new Error(error.error || 'Failed to mark notification as read');
    }
  },

  /**
   * Mark multiple notifications as read in one request.
   */
  markNotificationsRead: async (notificationIds?: string[], markAllRead = false): Promise<void> => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds, markAllRead }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark notifications as read' }));
      throw new Error(error.error || 'Failed to mark notifications as read');
    }
  },

  /**
   * Dismiss one or more notifications from the inbox.
   */
  dismissNotifications: async (notificationIds: string[]): Promise<void> => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds, dismiss: true }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to dismiss notifications' }));
      throw new Error(error.error || 'Failed to dismiss notifications');
    }
  },
};
