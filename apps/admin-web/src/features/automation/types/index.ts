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
  | 'less_than';

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export type ActionType = 'SEND_MESSAGE' | 'CREATE_TASK' | 'CREATE_NOTIFICATION';

export interface SendMessageActionConfig {
  template_id: string;
  variables?: Record<string, any>;
  contact_id?: string;
  student_id?: string;
  parent_id?: string;
  owned_number_id?: string;
}

export interface CreateTaskActionConfig {
  title_template: string;
  description_template?: string;
  assigned_to?: string;
  priority?: number;
  due_date_offset_days?: number;
  estimate?: number;
  variables?: Record<string, any>;
}

export interface CreateNotificationActionConfig {
  notification_type: string;
  title: string;
  body?: string;
  action_url?: string;
  staff_id?: string;
  variables?: Record<string, any>;
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

