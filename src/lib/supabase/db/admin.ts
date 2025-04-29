import { v4 as uuidv4 } from 'uuid';
import { supabaseServer, getSupabaseClient } from '../client';
import { Staff, Student } from './types';

/**
 * Repository for admin-specific operations
 */
export class AdminRepository {
  /**
   * Get the appropriate Supabase client for the current environment
   */
  private getClient() {
    return getSupabaseClient();
  }
  
  /**
   * Ensures the current user has an admin record in the staff table
   */
  async ensureAdminUser(): Promise<boolean> {
    const supabase = this.getClient();
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
            role: 'ADMINSTAFF',
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
  }

  /**
   * Adds a test student record for development purposes
   */
  async addTestStudent(): Promise<Student> {
    try {
      // Ensure user is an admin first
      await this.ensureAdminUser();
      const supabase = this.getClient();

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

      return data as Student;
    } catch (error: unknown) {
      console.error('Error in addTestStudent:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Get the current authenticated staff member
   */
  async getCurrentStaff(): Promise<Staff | null> {
    try {
      const supabase = this.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as Staff;
    } catch (error) {
      console.error('Error getting current staff:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminRepository = new AdminRepository(); 