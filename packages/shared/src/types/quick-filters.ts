export interface QuickFilterConfig {
  [key: string]: unknown[];
}

export interface QuickFilter {
  id: string;
  user_id: string | null;
  target_entity: string;
  name: string;
  config: QuickFilterConfig;
  created_at: string;
  updated_at: string;
}

export type QuickFilterPlaceholder = 
  | '$ME$' 
  | '$TODAY$' 
  | '$TOMORROW$' 
  | '$YESTERDAY$' 
  | '$FUTURE$' 
  | '$PAST$' 
  | '$THIS_WEEK$'
  | '$MONDAY_THIS_WEEK$'
  | '$SUNDAY_THIS_WEEK$';
