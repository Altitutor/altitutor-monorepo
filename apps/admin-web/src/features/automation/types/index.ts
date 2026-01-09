// Types will be properly generated after migrations are applied
// For now, using manual type definitions
export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  event_types: string[];
  conditions: any | null;
  enabled: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleInsert {
  name: string;
  description?: string | null;
  entity_type: string;
  event_types: string[];
  conditions?: any | null;
  enabled?: boolean;
  priority?: number;
  created_by?: string | null;
}

export interface AutomationRuleUpdate {
  name?: string;
  description?: string | null;
  entity_type?: string;
  event_types?: string[];
  conditions?: any | null;
  enabled?: boolean;
  priority?: number;
}

export interface AutomationAction {
  id: string;
  rule_id: string;
  action_type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'CREATE_NOTIFICATION';
  action_config: any;
  order_index: number;
  created_at: string;
}

export interface AutomationActionInsert {
  rule_id: string;
  action_type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'CREATE_NOTIFICATION';
  action_config: any;
  order_index?: number;
}

export interface AutomationActionUpdate {
  rule_id?: string;
  action_type?: 'SEND_MESSAGE' | 'CREATE_TASK' | 'CREATE_NOTIFICATION';
  action_config?: any;
  order_index?: number;
}

export interface Notification {
  id: string;
  staff_id: string;
  activity_event_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
}

export interface NotificationInsert {
  staff_id: string;
  activity_event_id?: string | null;
  notification_type: string;
  title: string;
  body?: string | null;
  read_at?: string | null;
  action_url?: string | null;
}

export interface NotificationUpdate {
  staff_id?: string;
  activity_event_id?: string | null;
  notification_type?: string;
  title?: string;
  body?: string | null;
  read_at?: string | null;
  action_url?: string | null;
}

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

