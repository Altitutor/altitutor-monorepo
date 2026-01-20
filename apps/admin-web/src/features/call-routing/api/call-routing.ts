import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type CallRoutingRule = Tables<'call_routing_rules'>;
export type OnCallSchedule = Tables<'on_call_schedules'>;
export type OwnedNumber = Tables<'owned_numbers'>;

export type CallRoutingRuleType = 'BUSINESS_HOURS' | 'ON_CALL' | 'DEFAULT';
export type MessageType = 'TTS' | 'AUDIO';

export interface CallRoutingRuleCreateData {
  owned_number_id: string;
  rule_type: CallRoutingRuleType;
  priority: number;
  forward_to_phone?: string | null;
  message_type?: MessageType | null;
  message_text?: string | null;
  audio_url?: string | null;
  is_active?: boolean;
}

export interface CallRoutingRuleUpdateData {
  rule_type?: CallRoutingRuleType;
  priority?: number;
  forward_to_phone?: string | null;
  message_type?: MessageType | null;
  message_text?: string | null;
  audio_url?: string | null;
  is_active?: boolean;
}

export interface OnCallScheduleCreateData {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface OnCallScheduleUpdateData {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

export const callRoutingApi = {
  // ==================== Call Routing Rules ====================
  
  async getRoutingRules(ownedNumberId?: string): Promise<CallRoutingRule[]> {
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('call_routing_rules')
      .select('*')
      .order('priority', { ascending: true });
    
    if (ownedNumberId) {
      query = query.eq('owned_number_id', ownedNumberId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as CallRoutingRule[];
  },

  async createRoutingRule(data: CallRoutingRuleCreateData): Promise<CallRoutingRule> {
    const { data: result, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('call_routing_rules')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as CallRoutingRule;
  },

  async updateRoutingRule(
    id: string,
    updates: CallRoutingRuleUpdateData
  ): Promise<CallRoutingRule> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('call_routing_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CallRoutingRule;
  },

  async deleteRoutingRule(id: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('call_routing_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ==================== On-Call Schedules ====================
  
  async getOnCallSchedules(staffId?: string): Promise<OnCallSchedule[]> {
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('on_call_schedules')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (staffId) {
      query = query.eq('staff_id', staffId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as OnCallSchedule[];
  },

  async createOnCallSchedule(data: OnCallScheduleCreateData): Promise<OnCallSchedule> {
    const { data: result, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('on_call_schedules')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as OnCallSchedule;
  },

  async updateOnCallSchedule(
    id: string,
    updates: OnCallScheduleUpdateData
  ): Promise<OnCallSchedule> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('on_call_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as OnCallSchedule;
  },

  async deleteOnCallSchedule(id: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('on_call_schedules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ==================== Owned Numbers ====================
  
  async getOwnedNumbers(): Promise<OwnedNumber[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('owned_numbers')
      .select('*')
      .order('is_default', { ascending: false })
      .order('label');
    if (error) throw error;
    return (data ?? []) as OwnedNumber[];
  },
};
