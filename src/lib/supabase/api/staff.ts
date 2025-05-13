import { staffRepository } from '../db/repositories';
import { Staff, StaffRole, StaffStatus, Subject, StaffSubjects } from '../db/types';
import { adminRepository } from '../db/admin';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabaseServer } from '../client';
import { Database } from '../db/types';
import { staffSubjectsRepository, subjectRepository } from '../db/repositories';

/**
 * Staff API client for working with staff data
 */
export const staffApi = {
  /**
   * Get all staff members
   */
  getAllStaff: async (): Promise<Staff[]> => {
    return staffRepository.getAll();
  },
  
  /**
   * Get a staff member by ID
   */
  getStaff: async (id: string): Promise<Staff | undefined> => {
    return staffRepository.getById(id);
  },
  
  /**
   * Create a new staff member with a user account
   */
  createStaff: async (data: Partial<Staff>, password: string): Promise<{ staff: Staff; userId: string }> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    // Create user account first
    const { data: userData, error: userError } = await supabaseServer.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        user_role: data.role || StaffRole.TUTOR,
        first_name: data.firstName,
        last_name: data.lastName,
      },
    });
    
    if (userError) {
      console.error('Error creating staff user:', userError);
      throw userError;
    }

    if (!userData.user) {
      throw new Error('Failed to create user account');
    }
    
    // Create staff record with newly created user ID
    const staffData: Partial<Staff> = {
      ...data,
      userId: userData.user.id,
      status: StaffStatus.ACTIVE,
    };
    
    const staff = await staffRepository.create(staffData);
    
    return { staff, userId: userData.user.id };
  },
  
  /**
   * Update a staff member
   */
  updateStaff: async (id: string, data: Partial<Staff>): Promise<Staff> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    // If we're updating the role, also update the user_metadata
    if (data.role && data.userId) {
      try {
        await supabaseServer.auth.admin.updateUserById(data.userId, {
          user_metadata: {
            user_role: data.role,
          },
        });
      } catch (error) {
        console.error('Error updating user role:', error);
        // Continue with staff update even if user metadata update fails
      }
    }
    
    return staffRepository.update(id, data);
  },
  
  /**
   * Delete a staff member
   */
  deleteStaff: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    // Get the staff record to find the user ID
    const staff = await staffRepository.getById(id);
    
    // Delete the staff record first
    await staffRepository.delete(id);
    
    // If there's a user ID, also delete the user account
    if (staff?.userId) {
      try {
        await supabaseServer.auth.admin.deleteUser(staff.userId);
      } catch (error) {
        console.error('Error deleting user account:', error);
        // Continue even if user account deletion fails
      }
    }
  },
  
  /**
   * Invite staff member by email (using a temporary password)
   */
  inviteStaff: async (data: Partial<Staff>): Promise<{ staff: Staff; userId: string }> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    try {
      let userId = '';
      
      // If email is provided, create a user account
      if (data.email) {
        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-2);
        
        // Get the base URL (works in both browser and server environments)
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        
        // Create the user with the temporary password and auto-confirm the email
        const { data: userData, error: userError } = await supabaseServer.auth.signUp({
          email: data.email,
          password: tempPassword,
          options: {
            data: {
              user_role: data.role || StaffRole.TUTOR,
              first_name: data.firstName,
              last_name: data.lastName,
            },
            emailRedirectTo: `${baseUrl}/auth/reset-password`
          }
        });
        
        if (userError) {
          console.error('Error creating staff user:', userError);
          throw userError;
        }

        if (!userData.user) {
          throw new Error('Failed to create user account');
        }
        
        userId = userData.user.id;
      } else {
        // If no email, generate a UUID for userId
        userId = crypto.randomUUID();
      }
      
      // Create staff record with user ID
      const staffData: Partial<Staff> = {
        ...data,
        userId,
        status: StaffStatus.ACTIVE,
      };
      
      const staff = await staffRepository.create(staffData);
      
      return { staff, userId };
    } catch (error) {
      console.error('Error inviting staff:', error);
      throw error;
    }
  },
  
  /**
   * Get the current staff member (for logged in user)
   */
  getCurrentStaff: async (): Promise<Staff | null> => {
    return adminRepository.getCurrentStaff();
  },

  /**
   * Get all subjects assigned to a staff member
   */
  getStaffSubjects: async (staffId: string): Promise<Subject[]> => {
    try {
      // Get all staff_subjects entries for this staff member
      const staffSubjects = await staffSubjectsRepository.getBy('staff_id', staffId);
      
      if (!staffSubjects.length) {
        return [];
      }
      
      // Get subject details for each subject_id
      const subjectPromises = staffSubjects.map(async (staffSubject) => {
        return subjectRepository.getById(staffSubject.subjectId);
      });
      
      const subjectResults = await Promise.all(subjectPromises);
      // Filter out undefined results (in case a subject doesn't exist anymore)
      return subjectResults.filter(subject => subject !== undefined) as Subject[];
    } catch (error) {
      console.error('Error getting staff subjects:', error);
      throw error;
    }
  },
  
  /**
   * Assign a subject to a staff member
   */
  assignSubjectToStaff: async (staffId: string, subjectId: string): Promise<StaffSubjects> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Check if the assignment already exists
      const existing = await staffSubjectsRepository.findByField('staff_id', staffId);
      if (existing && existing.subjectId === subjectId) {
        return existing; // Already assigned, return existing record
      }
      
      // Create the staff-subject assignment
      const staffSubject: Partial<StaffSubjects> = {
        staffId,
        subjectId,
      };
      
      return staffSubjectsRepository.create(staffSubject);
    } catch (error) {
      console.error('Error assigning subject to staff:', error);
      throw error;
    }
  },
  
  /**
   * Remove a subject from a staff member
   */
  removeSubjectFromStaff: async (staffId: string, subjectId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Get all staff-subject records for this staff member and subject
      const staffSubjects = await staffSubjectsRepository.getBy('staff_id', staffId);
      
      // Find the specific record for this subject
      const recordToDelete = staffSubjects.find(record => record.subjectId === subjectId);
      
      if (recordToDelete) {
        await staffSubjectsRepository.delete(recordToDelete.id);
      }
    } catch (error) {
      console.error('Error removing subject from staff:', error);
      throw error;
    }
  },
}; 