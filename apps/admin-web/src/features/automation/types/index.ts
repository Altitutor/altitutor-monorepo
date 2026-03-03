import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';

export type AutomationRule = Tables<'automation_rules'>;
export type AutomationRuleInsert = TablesInsert<'automation_rules'>;
export type AutomationRuleUpdate = TablesUpdate<'automation_rules'>;

export type AutomationAction = Tables<'automation_actions'>;
export type AutomationActionInsert = TablesInsert<'automation_actions'>;
export type AutomationActionUpdate = TablesUpdate<'automation_actions'>;

export type Notification = Tables<'notifications'>;
export type NotificationInsert = TablesInsert<'notifications'>;
export type NotificationUpdate = TablesUpdate<'notifications'>;

// Re-export TablesUpdate for convenience
export type { TablesUpdate };

export type AutomationRuleWithActions = AutomationRule & {
  actions: AutomationAction[];
};

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'greater_than' 
  | 'less_than'
  | 'field_changed'      // Field was changed (any change)
  | 'changed_from'       // Field changed from specific value
  | 'changed_to'         // Field changed to specific value
  | 'changed_from_to';   // Field changed from X to Y

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean;  // For: equals, not_equals, contains, not_contains, greater_than, less_than, changed_from, changed_to
  old_value?: string | number | boolean;  // For: changed_from_to
  new_value?: string | number | boolean;  // For: changed_from_to
}

export type ActionType = 'SEND_MESSAGE' | 'CREATE_TASK' | 'CREATE_NOTIFICATION';

// Recipient type definitions for bulk operations
export type NotificationRecipientType = 
  | 'single' 
  | 'class_students' 
  | 'class_staff' 
  | 'class_all' 
  | 'session_students' 
  | 'session_staff' 
  | 'session_all'
  | 'all_admin_staff'
  | 'all_staff'
  | 'admin_staff_on_day'
  | 'tutor_log_staff';

export type MessageRecipientType = 
  | 'single'
  | 'class_students' 
  | 'class_students_and_parents' 
  | 'session_students' 
  | 'session_students_and_parents'
  | 'student_and_parents'
  | 'tutor_log_students'
  | 'tutor_log_students_and_parents';

export interface SendMessageActionConfig {
  message_content: string;
  variables?: Record<string, string | number | boolean>;
  contact_id?: string;  // For single recipient (backward compat)
  student_id?: string;
  parent_id?: string;
  owned_number_id?: string;
  recipients?: {
    type: MessageRecipientType;
  };
}

export interface CreateTaskActionConfig {
  title_template: string;
  description_template?: string;
  assigned_to?: string;
  priority?: number;
  due_date_offset_days?: number;
  estimate?: number;
  variables?: Record<string, string | number | boolean>;
}

export interface CreateNotificationActionConfig {
  notification_type: string;
  title: string;
  body?: string;
  action_url?: string;
  staff_id?: string;  // For single recipient (backward compat)
  student_id?: string;  // For single recipient
  recipients?: {
    type: NotificationRecipientType;
  };
  variables?: Record<string, string | number | boolean>;
}

export type ActionConfig = 
  | SendMessageActionConfig 
  | CreateTaskActionConfig 
  | CreateNotificationActionConfig;

export type ActivityEntityType = 
  | 'sessions'
  | 'students'
  | 'classes'
  | 'tasks'
  | 'staff'
  | 'parents'
  | 'invoices'
  | 'invoice_items'
  | 'notes'
  | 'student_subsidies'
  | 'students_subjects'
  | 'tutor_logs'
  | 'tutor_logs_staff_attendance'
  | 'tutor_logs_student_attendance'
  | 'tutor_logs_topics'
  | 'tutor_logs_topics_files'
  | 'tutor_logs_topics_files_students'
  | 'tutor_logs_topics_students'
  | 'classes_staff'
  | 'classes_students'
  | 'sessions_students'
  | 'sessions_staff'
  | 'sessions_files'
  | 'parents_students';

export type ActivityEventType = 'CREATED' | 'UPDATED' | 'DELETED' | 'FIELD_CHANGED';

