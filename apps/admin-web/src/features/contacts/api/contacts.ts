import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ContactWithRelations = {
  id: string;
  phone_e164: string;
  contact_type: 'PARENT' | 'STUDENT' | 'STAFF' | 'LEAD' | 'OTHER';
  student_id: string | null;
  parent_id: string | null;
  staff_id: string | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  parents: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  staff: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
};

export const contactsApi = {
  /**
   * Get all contacts with related data
   */
  async getAllContacts(): Promise<ContactWithRelations[]> {
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
          id, first_name, last_name, email
        ),
        parents (
          id, first_name, last_name, email
        ),
        staff (
          id, first_name, last_name, email
        )
      `)
      .order('contact_type', { ascending: true })
      .order('phone_e164', { ascending: true });
    
    if (error) throw error;
    return (data ?? []) as ContactWithRelations[];
  },
};
