import { staffRepository } from '../db/repositories';
import { Staff, StaffRole, StaffStatus } from '../db/types';
import { adminRepository } from '../db/admin';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabaseServer } from '../client';
import { Database } from '../db/types';

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
   * Invite staff member by email (no password required)
   */
  inviteStaff: async (data: Partial<Staff>): Promise<{ staff: Staff; userId: string }> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    if (!data.email) {
      throw new Error('Email is required for staff invitation');
    }
    
    // Create user account first
    const { data: userData, error: userError } = await supabaseServer.auth.admin.inviteUserByEmail(data.email, {
      data: {
        user_role: data.role || StaffRole.TUTOR,
        first_name: data.firstName,
        last_name: data.lastName,
      },
    });
    
    if (userError) {
      console.error('Error inviting staff user:', userError);
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
   * Get the current staff member (for logged in user)
   */
  getCurrentStaff: async (): Promise<Staff | null> => {
    return adminRepository.getCurrentStaff();
  },
}; 