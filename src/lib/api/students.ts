import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  status: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface CreateStudentRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  status?: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';
  notes?: string;
}

type UpdateStudentRequest = Partial<CreateStudentRequest>;

export const studentsApi = {
  /**
   * Get all students
   */
  getAll: async () => {
    const supabase = createClientComponentClient();
    const { data, error } = await supabase
      .from('students')
      .select('*');
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get a student by ID
   */
  getById: async (id: string) => {
    const supabase = createClientComponentClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Create a new student
   */
  create: async (data: CreateStudentRequest) => {
    const supabase = createClientComponentClient();
    const { data: newStudent, error } = await supabase
      .from('students')
      .insert([{
        ...data,
        id: crypto.randomUUID() // Generate UUID on client side
      }])
      .select()
      .single();
    
    if (error) throw error;
    return newStudent;
  },
  
  /**
   * Update a student
   */
  update: async (id: string, data: UpdateStudentRequest) => {
    const supabase = createClientComponentClient();
    const { data: updatedStudent, error } = await supabase
      .from('students')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updatedStudent;
  },
  
  /**
   * Delete a student
   */
  delete: async (id: string) => {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { message: 'Student deleted successfully' };
  },
}; 