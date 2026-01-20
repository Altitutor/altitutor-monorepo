'use client';

import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contact API functions
 * Separated from component logic following bulletproof React principles
 */

export type ContactWithRelations = {
  id: string;
  phone_e164: string | null;
  contact_type: string;
  student_id: string | null;
  parent_id: string | null;
  staff_id: string | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    year_level: number | null;
    curriculum: string | null;
    user_id: string | null;
  } | null;
  parents: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    parents_students: Array<{
      students: {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        status: string;
        year_level: number | null;
        curriculum: string | null;
      };
    }>;
  } | null;
  staff: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    role: string;
    status: string;
    user_id: string | null;
  } | null;
};

/**
 * Get contact ID from conversation ID
 */
export async function getContactIdFromConversation(conversationId: string): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('conversations')
    .select('contact_id')
    .eq('id', conversationId)
    .maybeSingle();
  
  if (error) throw error;
  return data?.contact_id || null;
}

/**
 * Get contact by ID with all related data
 */
export async function getContactById(contactId: string): Promise<ContactWithRelations | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      phone_e164,
      contact_type,
      student_id,
      parent_id,
      staff_id,
      students (
        id, first_name, last_name, email, phone, status, year_level, curriculum, user_id
      ),
      parents (
        id, first_name, last_name, email, phone,
        parents_students (
          students (
            id, first_name, last_name, email, phone, status, year_level, curriculum
          )
        )
      ),
      staff (
        id, first_name, last_name, email, phone_number, role, status, user_id
      )
    `)
    .eq('id', contactId)
    .maybeSingle();
  
  if (error) throw error;
  return data as ContactWithRelations | null;
}
