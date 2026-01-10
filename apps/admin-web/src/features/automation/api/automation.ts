import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutomationRuleWithActions, AutomationRuleInsert, AutomationRuleUpdate, AutomationActionInsert } from '../types';

/**
 * Automation API client for working with automation rules and actions
 */
export const automationApi = {
  /**
   * Get all automation rules with their actions
   */
  listRules: async (): Promise<AutomationRuleWithActions[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select(`
        *,
        actions:automation_actions(*)
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as AutomationRuleWithActions[];
  },

  /**
   * Get a single automation rule with its actions
   */
  getRule: async (ruleId: string): Promise<AutomationRuleWithActions | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select(`
        *,
        actions:automation_actions(*)
      `)
      .eq('id', ruleId)
      .single();

    if (error) throw error;
    return data as unknown as AutomationRuleWithActions | null;
  },

  /**
   * Create a new automation rule
   */
  createRule: async (rule: AutomationRuleInsert): Promise<Tables<'automation_rules'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .insert(rule)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'automation_rules'>;
  },

  /**
   * Update an automation rule
   */
  updateRule: async (ruleId: string, updates: AutomationRuleUpdate): Promise<Tables<'automation_rules'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'automation_rules'>;
  },

  /**
   * Delete an automation rule (cascades to actions)
   */
  deleteRule: async (ruleId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  },

  /**
   * Create an automation action
   */
  createAction: async (action: AutomationActionInsert): Promise<Tables<'automation_actions'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_actions')
      .insert(action)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'automation_actions'>;
  },

  /**
   * Update an automation action
   */
  updateAction: async (actionId: string, updates: TablesUpdate<'automation_actions'>): Promise<Tables<'automation_actions'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('automation_actions')
      .update(updates)
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'automation_actions'>;
  },

  /**
   * Delete an automation action
   */
  deleteAction: async (actionId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('automation_actions')
      .delete()
      .eq('id', actionId);

    if (error) throw error;
  },

  /**
   * Get notifications for a staff member
   */
  getNotifications: async (staffId: string, unreadOnly = false): Promise<Tables<'notifications'>[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Tables<'notifications'>[];
  },

  /**
   * Mark notification as read
   */
  markNotificationRead: async (notificationId: string): Promise<Tables<'notifications'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'notifications'>;
  },

  /**
   * Mark all notifications as read for a staff member
   */
  markAllNotificationsRead: async (staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .is('read_at', null);

    if (error) throw error;
  },
};

