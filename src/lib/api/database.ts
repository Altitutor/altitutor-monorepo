import { supabase } from './auth';
import { v4 as uuidv4 } from 'uuid';

export const databaseApi = {
  async ensureAdminUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if user is already in staff table
    const { data: existingStaff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (staffError && staffError.code !== 'PGRST116') {
      console.error('Error checking staff:', staffError);
      throw staffError;
    }

    if (!existingStaff) {
      // Create staff record for the user
      const { error: insertError } = await supabase
        .from('staff')
        .insert([
          {
            id: uuidv4(),
            first_name: user.email?.split('@')[0] || 'Admin',
            last_name: 'User',
            email: user.email!,
            role: 'ADMIN',
            status: 'ACTIVE',
            user_id: user.id,
          }
        ]);

      if (insertError) {
        console.error('Error creating staff record:', insertError);
        throw insertError;
      }
    }

    return true;
  },

  async addTestStudent() {
    try {
      // Ensure user is an admin first
      await this.ensureAdminUser();

      const studentId = uuidv4();
      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            id: studentId,
            first_name: 'Test',
            last_name: 'Student',
            email: `test.student.${studentId.slice(0, 8)}@example.com`,
            phone_number: '1234567890',
            parent_name: 'Test Parent',
            parent_email: `test.parent.${studentId.slice(0, 8)}@example.com`,
            parent_phone: '0987654321',
            status: 'TRIAL',
            notes: 'Test student for development',
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding test student:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      return data;
    } catch (error: any) {
      console.error('Error in addTestStudent:', {
        message: error.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      throw error;
    }
  },

  async getStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
      throw error;
    }

    return data;
  },

  async getStudent(id: string) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      throw error;
    }

    return data;
  },

  async updateStudent(id: string, updates: any) {
    try {
      // Ensure user is an admin first
      await this.ensureAdminUser();

      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating student:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error in updateStudent:', error);
      throw error;
    }
  },

  async deleteStudent(id: string) {
    try {
      // Ensure user is an admin first
      await this.ensureAdminUser();

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting student:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error in deleteStudent:', error);
      throw error;
    }
  },
}; 