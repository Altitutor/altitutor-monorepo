import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { resolveNotificationRecipients } from '../recipients.ts';
import { replaceTemplateVariables, extractTemplateVariables } from '../utils.ts';

export async function executeCreateNotification(
  supabase: SupabaseClient,
  action: { id?: string; action_config?: unknown },
  activityEvent: Record<string, unknown>,
  rule: Record<string, unknown>,
  entityData?: Record<string, unknown> | null
): Promise<void> {
  const config = action.action_config as {
    notification_type: string;
    app_scope?: 'student_web' | 'ucat_web' | 'staff_web';
    title: string;
    body?: string;
    action_url?: string;
    staff_id?: string;
    student_id?: string;
    recipients?: {
      type: 'class_students' | 'class_staff' | 'class_all' | 
            'session_students' | 'session_staff' | 'session_all' | 
            'single' | 'all_admin_staff' | 'all_staff' | 'all_ucat_students' | 'admin_staff_on_day';
    };
    variables?: Record<string, unknown>;
  };

  // Extract variables from activity event and entity data
  const variables = await extractTemplateVariables(supabase, activityEvent, entityData);
  
  // Merge with any provided variables (config.variables takes precedence)
  const finalVariables = { ...variables, ...(config.variables || {}) };
  
  // Replace variables
  const title = replaceTemplateVariables(config.title, finalVariables);
  const body = config.body
    ? replaceTemplateVariables(config.body, finalVariables)
    : null;
  const actionUrl = config.action_url
    ? replaceTemplateVariables(config.action_url, finalVariables)
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

  const scopedRecipients = recipients.filter((recipient) => {
    if (config.app_scope === 'ucat_web' || config.app_scope === 'student_web') {
      return Boolean(recipient.student_id);
    }
    if (config.app_scope === 'staff_web') {
      return Boolean(recipient.staff_id);
    }
    return true;
  });

  if (scopedRecipients.length === 0) {
    console.warn('[activity-processor] App destination excludes all recipients', {
      ruleId: rule.id,
      actionId: action.id,
      appScope: config.app_scope,
    });
    return;
  }

  // Create notifications for each compatible recipient
  const notificationsToInsert = scopedRecipients.map((recipient) => ({
    staff_id: recipient.staff_id || null,
    student_id: recipient.student_id || null,
    domain_event_id: activityEvent.domain_event_id || null,
    notification_type: config.notification_type,
    app_scope: config.app_scope || (recipient.student_id ? 'student_web' : 'staff_web'),
    title,
    body,
    action_url: actionUrl,
    dedupe_key:
      activityEvent.id && action.id
        ? `automation:${action.id}:${String(activityEvent.id)}:${recipient.student_id || recipient.staff_id}`
        : null,
  }));

  const createdNotificationIds: string[] = [];
  for (let offset = 0; offset < notificationsToInsert.length; offset += 500) {
    const batch = notificationsToInsert.slice(offset, offset + 500);
    const { data: createdNotifications, error: notifErr } = await supabase
      .from('notifications')
      .upsert(batch, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id');

    if (notifErr) {
      throw notifErr;
    }
    createdNotificationIds.push(
      ...(createdNotifications?.map((notification: { id: string }) => notification.id) || [])
    );
  }

  console.log('[activity-processor] Notifications created', {
    count: createdNotificationIds.length,
    notificationIds: createdNotificationIds,
  });
}
