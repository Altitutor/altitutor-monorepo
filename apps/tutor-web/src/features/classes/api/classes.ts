import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Classes API client for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_classes, vtutor_class_detail)
 * All writes must go through API routes that use service role client
 */
export const classesApi = {
  /**
   * Get all classes accessible to the current tutor
   * Uses vtutor_classes view
   */
  getAllClasses: async () => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_classes')
      .select('*');
    if (error) throw error;
    return data ?? [];
  },
  
  /**
   * Get a single class with all details
   * Uses vtutor_class_detail view which includes students and staff
   */
  getClassWithDetails: async (classId: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      const { data, error } = await supabase
        .from('vtutor_class_detail')
        .select('*')
        .eq('class_id', classId)
        .maybeSingle();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting class with details:', error);
      throw error;
    }
  },
  
  /**
   * Get a class by ID (simplified - uses view)
   */
  getClass: async (id: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_classes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },
  
  /**
   * Get classes by day of week
   * Uses vtutor_classes view
   */
  getClassesByDay: async (dayOfWeek: number) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_classes')
      .select('*')
      .eq('day_of_week', dayOfWeek);
    if (error) throw error;
    return data ?? [];
  },
  
  /**
   * Get classes by status
   * Uses vtutor_classes view
   */
  getClassesByStatus: async (status: string) => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('vtutor_classes')
      .select('*')
      .eq('status', status);
    if (error) throw error;
    return data ?? [];
  },
};
