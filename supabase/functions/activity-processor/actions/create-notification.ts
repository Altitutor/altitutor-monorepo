// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveNotificationRecipients } from '../recipients.ts';
import { replaceTemplateVariables } from '../utils.ts';

export async function executeCreateNotification(
  supabase: SupabaseClient<any>,
  action: any,
  activityEvent: any,
  rule: any
): Promise<void> {
  const config = action.action_config as {
    notification_type: string;
    title: string;
    body?: string;
    action_url?: string;
    staff_id?: string;
    student_id?: string;
    recipients?: {
      type: 'class_students' | 'class_staff' | 'class_all' | 
            'session_students' | 'session_staff' | 'session_all' | 
            'single';
    };
    variables?: Record<string, any>;
  };

  // Replace variables
  const title = replaceTemplateVariables(config.title, config.variables || {});
  const body = config.body
    ? replaceTemplateVariables(config.body, config.variables || {})
    : null;

  // Determine recipients
  let recipients: Array<{ staff_id?: string; student_id?: string }> = [];

  if (config.recipients && config.recipients.type !== 'single') {
    // Bulk recipients based on recipient type
    recipients = await resolveNotificationRecipients(
      supabase,
      config.recipients.type,
      activityEvent
    );
  } else {
    // Single recipient (backward compatible)
    if (config.student_id) {
      recipients = [{ student_id: config.student_id }];
    } else if (config.staff_id) {
      recipients = [{ staff_id: config.staff_id }];
    } else {
      // Fallback to activity event context
      const studentId = activityEvent.student_id || null;
      const staffId = activityEvent.staff_id || activityEvent.performed_by || null;
      
      if (studentId) {
        recipients = [{ student_id: studentId }];
      } else if (staffId) {
        recipients = [{ staff_id: staffId }];
      }
    }
  }

  if (recipients.length === 0) {
    console.warn('[activity-processor] No recipients found for notification', {
      ruleId: rule.id,
      actionId: action.id,
      recipientType: config.recipients?.type || 'single',
    });
    return; // Skip if no recipients (don't fail)
  }

  // Create notifications for each recipient
  const notificationsToInsert = recipients.map((recipient) => ({
    staff_id: recipient.staff_id || null,
    student_id: recipient.student_id || null,
    activity_event_id: activityEvent.id,
    notification_type: config.notification_type,
    title,
    body,
    action_url: config.action_url || null,
  }));

  const { data: createdNotifications, error: notifErr } = await supabase
    .from('notifications')
    .insert(notificationsToInsert)
    .select('id');

  if (notifErr) {
    throw notifErr;
  }

  console.log('[activity-processor] Notifications created', {
    count: createdNotifications?.length || 0,
    notificationIds: createdNotifications?.map((n: any) => n.id) || [],
  });
}
