import { supabaseServer } from '@/shared/lib/supabase/client';
import { Staff, StaffRole, Database } from '@/shared/lib/supabase/database/types';

export interface StaffCreateData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  role: StaffRole;
  notes?: string;
  office_key_number?: number;
  has_parking_remote?: 'VIRTUAL' | 'PHYSICAL' | 'NONE';
  availability_monday?: boolean;
  availability_tuesday?: boolean;
  availability_wednesday?: boolean;
  availability_thursday?: boolean;
  availability_friday?: boolean;
  availability_saturday_am?: boolean;
  availability_saturday_pm?: boolean;
  availability_sunday_am?: boolean;
  availability_sunday_pm?: boolean;
}

export interface StaffUpdateData extends Partial<StaffCreateData> {
  status?: 'ACTIVE' | 'INACTIVE' | 'TRIAL';
}

export interface CreateStaffRequest extends StaffCreateData {
  password: string;
}

export const staffApi = {
  // Get all staff
  getAll: async (): Promise<Staff[]> => {
    const { data, error } = await supabaseServer
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return data || [];
  },

  // Get staff by ID
  getById: async (id: string): Promise<Staff | null> => {
    const { data, error } = await supabaseServer
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return data;
  },

  // Get staff by user_id
  getByUserId: async (userId: string): Promise<Staff | null> => {
    const { data, error } = await supabaseServer
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return data;
  },

  // Create new staff (creates auth user and staff record)
  create: async (data: CreateStaffRequest): Promise<Staff> => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        // NOTE: No longer setting user_metadata.user_role since we use staff table roles
        user_metadata: {
          first_name: data.first_name,
          last_name: data.last_name,
        }
      });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Auth user creation succeeded but no user returned');
      }

      // Create staff record
      const staffData = {
        id: authData.user.id,
        user_id: authData.user.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role: data.role,
        status: 'ACTIVE' as const,
        notes: data.notes,
        office_key_number: data.office_key_number,
        has_parking_remote: data.has_parking_remote,
        availability_monday: data.availability_monday || false,
        availability_tuesday: data.availability_tuesday || false,
        availability_wednesday: data.availability_wednesday || false,
        availability_thursday: data.availability_thursday || false,
        availability_friday: data.availability_friday || false,
        availability_saturday_am: data.availability_saturday_am || false,
        availability_saturday_pm: data.availability_saturday_pm || false,
        availability_sunday_am: data.availability_sunday_am || false,
        availability_sunday_pm: data.availability_sunday_pm || false,
      };

      const { data: staffRecord, error: staffError } = await supabaseServer
        .from('staff')
        .insert(staffData)
        .select()
        .single();

      if (staffError) {
        // Clean up the auth user if staff creation fails
        await supabaseServer.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create staff record: ${staffError.message}`);
      }

      return staffRecord;
    } catch (error) {
      throw new Error(`Unexpected error creating staff: ${error}`);
    }
  },

  // Update staff
  update: async (id: string, data: StaffUpdateData): Promise<Staff> => {
    // Get current staff record to get user_id for auth update
    const { data: currentStaff, error: fetchError } = await supabaseServer
      .from('staff')
      .select('user_id, email')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current staff: ${fetchError.message}`);
    }

    try {
      // Update auth user if email or role changed
      if (data.email || data.role) {
        const authUpdateData: any = {};
        
        if (data.email) {
          authUpdateData.email = data.email;
        }
        
        // Update user metadata
        authUpdateData.user_metadata = {
          first_name: data.first_name,
          last_name: data.last_name,
          // NOTE: No longer setting user_role in user_metadata since we use staff table roles
        };

        const { error: authError } = await supabaseServer.auth.admin.updateUserById(
          currentStaff.user_id,
          authUpdateData
        );

        if (authError) {
          throw new Error(`Failed to update auth user: ${authError.message}`);
        }
      }

      // Update staff record
      const { data: updatedStaff, error: updateError } = await supabaseServer
        .from('staff')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          role: data.role,
          status: data.status,
          notes: data.notes,
          office_key_number: data.office_key_number,
          has_parking_remote: data.has_parking_remote,
          availability_monday: data.availability_monday,
          availability_tuesday: data.availability_tuesday,
          availability_wednesday: data.availability_wednesday,
          availability_thursday: data.availability_thursday,
          availability_friday: data.availability_friday,
          availability_saturday_am: data.availability_saturday_am,
          availability_saturday_pm: data.availability_saturday_pm,
          availability_sunday_am: data.availability_sunday_am,
          availability_sunday_pm: data.availability_sunday_pm,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update staff: ${updateError.message}`);
      }

      return updatedStaff;
    } catch (error) {
      throw new Error(`Unexpected error updating staff: ${error}`);
    }
  },

  // Delete staff
  delete: async (id: string): Promise<void> => {
    // Get staff record to get user_id for auth deletion
    const { data: staff, error: fetchError } = await supabaseServer
      .from('staff')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch staff: ${fetchError.message}`);
    }

    // Delete staff record (this will trigger cascade delete)
    const { error: deleteError } = await supabaseServer
      .from('staff')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete staff: ${deleteError.message}`);
    }

    // Delete auth user
    const { error: authError } = await supabaseServer.auth.admin.deleteUser(staff.user_id);
    if (authError) {
      console.warn(`Failed to delete auth user ${staff.user_id}: ${authError.message}`);
      // Don't throw here as the staff record is already deleted
    }
  },

  // Create staff account (variant that doesn't require password - for existing users)
  createAccount: async (data: StaffCreateData & { user_id: string }): Promise<Staff> => {
    const staffData = {
      id: data.user_id,
      user_id: data.user_id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone_number: data.phone_number,
      role: data.role,
      status: 'ACTIVE' as const,
      notes: data.notes,
      office_key_number: data.office_key_number,
      has_parking_remote: data.has_parking_remote,
      availability_monday: data.availability_monday || false,
      availability_tuesday: data.availability_tuesday || false,
      availability_wednesday: data.availability_wednesday || false,
      availability_thursday: data.availability_thursday || false,
      availability_friday: data.availability_friday || false,
      availability_saturday_am: data.availability_saturday_am || false,
      availability_saturday_pm: data.availability_saturday_pm || false,
      availability_sunday_am: data.availability_sunday_am || false,
      availability_sunday_pm: data.availability_sunday_pm || false,
    };

    // Update auth user metadata
    const { error: authError } = await supabaseServer.auth.admin.updateUserById(
      data.user_id,
      {
        // NOTE: No longer setting user_role in user_metadata since we use staff table roles
        user_metadata: {
          first_name: data.first_name,
          last_name: data.last_name,
        }
      }
    );

    if (authError) {
      throw new Error(`Failed to update auth user: ${authError.message}`);
    }

    const { data: staffRecord, error: staffError } = await supabaseServer
      .from('staff')
      .insert(staffData)
      .select()
      .single();

    if (staffError) {
      throw new Error(`Failed to create staff record: ${staffError.message}`);
    }

    return staffRecord;
  },

  // Get all staff (alias for compatibility with hooks)
  getAllStaff: async (): Promise<Staff[]> => {
    return staffApi.getAll();
  },

  // Get all staff with their subjects (optimized query)
  getAllStaffWithSubjects: async () => {
    const { data: staffData, error: staffError } = await supabaseServer
      .from('staff')
      .select(`
        *,
        staff_subjects (
          id,
          subject_id,
          subjects (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (staffError) {
      throw new Error(`Failed to fetch staff with subjects: ${staffError.message}`);
    }

    return {
      staff: staffData || [],
      subjects: [] // For backward compatibility if needed
    };
  },

  // Get staff member with subjects by ID
  getStaffWithSubjects: async (staffId: string) => {
    const { data: staffData, error: staffError } = await supabaseServer
      .from('staff')
      .select(`
        *,
        staff_subjects (
          id,
          subject_id,
          subjects (*)
        )
      `)
      .eq('id', staffId)
      .single();

    if (staffError) {
      if (staffError.code === 'PGRST116') {
        return { staff: null, subjects: [] };
      }
      throw new Error(`Failed to fetch staff with subjects: ${staffError.message}`);
    }

    // Extract subjects from the nested data structure
    const subjects = staffData?.staff_subjects?.map((ss: any) => ss.subjects).filter(Boolean) || [];

    return {
      staff: staffData,
      subjects: subjects
    };
  },

  // Get subjects for a specific staff member
  getStaffSubjects: async (staffId: string) => {
    const { data, error } = await supabaseServer
      .from('staff_subjects')
      .select(`
        subjects (*)
      `)
      .eq('staff_id', staffId);

    if (error) {
      throw new Error(`Failed to fetch staff subjects: ${error.message}`);
    }

    return data?.map((item: any) => item.subjects).filter(Boolean) || [];
  }
}; 