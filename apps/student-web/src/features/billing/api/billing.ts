import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

const supabase = createClientComponentClient<Database>();

type StudentRow = Database['public']['Tables']['students']['Row'];

export const billingApi = {
  /**
   * Get billing info from vstudent_billing view
   */
  getBilling: async () => {
    const { data, error } = await supabase
      .from('vstudent_billing')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get payment history
   */
  getPayments: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get student ID first
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (studentError) throw studentError;
    if (!studentData) throw new Error('Student not found');

    const studentId = (studentData as Pick<StudentRow, 'id'>).id;

    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        session:sessions(
          id,
          type,
          start_at,
          subject:subjects(name)
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};

