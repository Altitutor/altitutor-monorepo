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
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select(`
        *,
        actions:automation_actions(*)
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AutomationRuleWithActions[];
  },

  /**
   * Get a single automation rule with its actions
   */
  getRule: async (ruleId: string): Promise<AutomationRuleWithActions | null> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .select(`
        *,
        actions:automation_actions(*)
      `)
      .eq('id', ruleId)
      .single();

    if (error) throw error;
    return data as AutomationRuleWithActions | null;
  },

  /**
   * Create a new automation rule
   */
  createRule: async (rule: AutomationRuleInsert): Promise<any> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .insert(rule)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an automation rule
   */
  updateRule: async (ruleId: string, updates: AutomationRuleUpdate): Promise<any> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an automation rule (cascades to actions)
   */
  deleteRule: async (ruleId: string): Promise<void> => {
    const supabase = getSupabaseClient() as any;
    
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  },

  /**
   * Create an automation action
   */
  createAction: async (action: AutomationActionInsert): Promise<any> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_actions')
      .insert(action)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an automation action
   */
  updateAction: async (actionId: string, updates: any): Promise<any> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('automation_actions')
      .update(updates)
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an automation action
   */
  deleteAction: async (actionId: string): Promise<void> => {
    const supabase = getSupabaseClient() as any;
    
    const { error } = await supabase
      .from('automation_actions')
      .delete()
      .eq('id', actionId);

    if (error) throw error;
  },

  /**
   * Get notifications for a staff member
   */
  getNotifications: async (staffId: string, unreadOnly = false): Promise<any[]> => {
    const supabase = getSupabaseClient() as any;
    
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
    return (data ?? []);
  },

  /**
   * Mark notification as read
   */
  markNotificationRead: async (notificationId: string): Promise<any> => {
    const supabase = getSupabaseClient() as any;
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Mark all notifications as read for a staff member
   */
  markAllNotificationsRead: async (staffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as any;
    
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .is('read_at', null);

    if (error) throw error;
  },
};

