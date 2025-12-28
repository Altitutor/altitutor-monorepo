import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate, Database, ClassWithExpandedSubject } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type StaffListItem = Pick<
  Tables<'staff'>,
  'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'phone_number' | 'email'
> & {
  classes?: ClassWithExpandedSubject[];
};

export interface StaffCreateData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  role: string;
  notes?: string;
  office_key_number?: number;
  has_parking_remote?: 'VIRTUAL' | 'PHYSICAL' | 'NONE';
  availability_monday?: boolean | null;
  availability_tuesday?: boolean | null;
  availability_wednesday?: boolean | null;
  availability_thursday?: boolean | null;
  availability_friday?: boolean | null;
  availability_saturday_am?: boolean | null;
  availability_saturday_pm?: boolean | null;
  availability_sunday_am?: boolean | null;
  availability_sunday_pm?: boolean | null;
}

export interface StaffUpdateData extends Partial<StaffCreateData> {
  status?: string;
}

// Input from UI for inviting/creating staff (camelCase fields)
export interface StaffInviteData {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone_number?: string | null;
  role: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'TRIAL';
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

export const staffApi = {
  // Get all staff
  getAll: async (): Promise<Tables<'staff'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff')
      .select('id, first_name, last_name, email, phone_number, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return (data ?? []) as Tables<'staff'>[];
  },

  /**
   * Paginated, server-filtered staff list for pickers
   */
  list: async (params: { search?: string; role?: string; status?: string; limit?: number; offset?: number }): Promise<{ staff: StaffListItem[]; total: number }> => {
    const { search = '', role, status, limit = 20, offset = 0 } = params || {};
    let query = (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff')
      .select('id, first_name, last_name, email, phone_number, role, status', { count: 'exact' })
      .order('created_at', { ascending: false });

    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`);
    }

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query.range(offset, Math.max(offset + limit - 1, offset));
    if (error) throw error;
    return { staff: (data ?? []) as Tables<'staff'>[], total: count ?? 0 };
  },

  /**
   * Minimal fields for table display only
   * Returns: id, first_name, last_name, role, status, phone, email
   * No subjects, no classes
   */
  listMinimal: async (params: {
    search?: string;
    role?: string;
    status?: string;
    roles?: string[];
    statuses?: string[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'staff'>;
    ascending?: boolean;
  }): Promise<{ staff: StaffListItem[]; total: number }> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const {
      search = '',
      role,
      status,
      roles = [],
      statuses = [],
      limit = 50,
      offset = 0,
      orderBy = 'last_name',
      ascending = true,
    } = params || {};

    const trimmed = search.trim();
    const roleFilters = roles.length > 0 ? roles : role ? [role] : [];
    const statusFilters = statuses.length > 0 ? statuses : status ? [status] : [];

    // Use RPC function when search term is provided
    if (trimmed.length > 0) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: trimmed,
        p_statuses: statusFilters.length > 0 ? statusFilters : ['ACTIVE'],
        p_include_relationships: true,
        p_limit: limit,
        p_offset: offset,
        p_order_by: orderBy as string,
        p_ascending: ascending,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { staff: [], total: 0 };

      const rpcData = rpcResult as { staff: any[]; staffClasses: Record<string, any[]>; classSubjects: Record<string, any>; total: number };
      let staff = (rpcData.staff || []) as any[];

      // Apply role filter that RPC doesn't support
      if (roleFilters.length > 0) {
        staff = staff.filter((s) => s.role && roleFilters.includes(s.role));
      }

      // Transform RPC response to match expected format
      const staffClassesMap: Record<string, ClassWithExpandedSubject[]> = {};
      staff.forEach((s) => {
        const classes = rpcData.staffClasses?.[s.id] || [];
        staffClassesMap[s.id] = classes.map((cls: any) => {
          const subject = cls.subject || rpcData.classSubjects?.[cls.id] || null;
          return {
            ...cls,
            subject,
          } as ClassWithExpandedSubject;
        });
      });

      const transformedStaff = staff.map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
        status: s.status,
        phone_number: s.phone_number,
        email: s.email,
        classes: staffClassesMap[s.id] || [],
      })) as StaffListItem[];

      // Recalculate total after filtering (approximate - RPC total may be higher)
      const total = transformedStaff.length < limit ? transformedStaff.length : rpcData.total;

      return {
        staff: transformedStaff,
        total,
      };
    }

    // No search term - use existing query logic
    let query = supabase
      .from('staff')
      .select('id, first_name, last_name, role, status, phone_number, email', { count: 'exact' })
      .order(orderBy as string, { ascending });

    if (roleFilters.length > 0) query = query.in('role', roleFilters);
    if (statusFilters.length > 0) query = query.in('status', statusFilters);

    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    const staff = (data ?? []) as StaffListItem[];

    if (staff.length === 0) {
      return { staff: [], total: count ?? 0 };
    }

    const staffIds = staff.map((member) => member.id);

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('classes_staff')
      .select(`
        staff_id,
        class:classes(
          *,
          subject_details:subjects(*)
        )
      `)
      .in('staff_id', staffIds)
      .is('unassigned_at', null);

    if (assignmentsError) throw assignmentsError;

    const staffClassesMap: Record<string, ClassWithExpandedSubject[]> = {};
    staffIds.forEach((id) => {
      staffClassesMap[id] = [];
    });

    (assignmentsData ?? []).forEach((assignment: any) => {
      const classWithSubject = assignment.class as (Tables<'classes'> & { subject_details?: Tables<'subjects'> }) | null;
      if (classWithSubject && assignment.staff_id) {
        const cls: ClassWithExpandedSubject = {
          ...classWithSubject,
          subject: classWithSubject.subject_details,
        };
        delete (cls as any).subject_details;
        staffClassesMap[assignment.staff_id].push(cls);
      }
    });

    const staffWithClasses = staff.map((staffMember) => ({
      ...staffMember,
      classes: staffClassesMap[staffMember.id] || [],
    }));

    return { staff: staffWithClasses, total: count ?? 0 };
  },

  /**
   * Get full staff details for modal view
   * Returns: staff, subjects, classes, upcoming sessions
   */
  getStaffDetails: async (staffId: string): Promise<{
    staff: Tables<'staff'> | null;
    subjects: Tables<'subjects'>[];
    classes: ClassWithExpandedSubject[];
    upcomingSessions: Tables<'sessions'>[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get staff record
      const staff = await staffApi.getById(staffId);
      if (!staff) {
        return {
          staff: null,
          subjects: [],
          classes: [],
          upcomingSessions: [],
        };
      }

      // Get all related data in parallel
      const [subjectsResult, classesResult, sessionsResult] = await Promise.all([
        // Subjects taught by this staff
        supabase
          .from('staff_subjects')
          .select('subject_details:subjects(*)')
          .eq('staff_id', staffId),
        
        // Classes assigned to this staff (current and future)
        supabase
          .from('classes_staff')
          .select(`
            class:classes(
              *,
              subject_details:subjects(*)
            )
          `)
          .eq('staff_id', staffId)
          .is('unassigned_at', null),
        
        // Upcoming sessions (next 5) - fetch from sessions_staff join
        supabase
          .from('sessions_staff')
          .select('sessions!inner(*)')
          .eq('staff_id', staffId),
      ]);

      if (subjectsResult.error) throw subjectsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      // Transform subjects
      const subjects = (subjectsResult.data ?? [])
        .map((row: any) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];

      // Transform classes
      const classes: ClassWithExpandedSubject[] = (classesResult.data ?? [])
        .map((row: any) => {
          const cls = row.class as (Tables<'classes'> & { subject_details?: Tables<'subjects'> }) | null;
          if (!cls) return null;
          const classWithSubject: ClassWithExpandedSubject = {
            ...cls,
            subject: cls.subject_details,
          };
          delete (classWithSubject as any).subject_details;
          return classWithSubject;
        })
        .filter(Boolean) as ClassWithExpandedSubject[];

      // Sessions - transform from sessions_staff join, filter and sort client-side
      const upcomingSessions = (sessionsResult.data ?? [])
        .map((row: any) => row.sessions)
        .filter((s: any) => s && s.start_at && new Date(s.start_at) >= new Date())
        .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
        .slice(0, 5) as Tables<'sessions'>[];

      return {
        staff,
        subjects,
        classes,
        upcomingSessions,
      };
    } catch (error) {
      console.error('Error getting staff details:', error);
      throw error;
    }
  },

  // Back-compat alias
  getStaff: async (id: string): Promise<Tables<'staff'> | null> => {
    return staffApi.getById(id);
  },

  // Get staff by ID
  getById: async (id: string): Promise<Tables<'staff'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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

    return (data ?? null) as Tables<'staff'> | null;
  },

  // Get staff by user_id
  getByUserId: async (userId: string): Promise<Tables<'staff'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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

    return (data ?? null) as Tables<'staff'> | null;
  },

  // Update staff - calls server-side API route for admin operations
  update: async (id: string, data: StaffUpdateData): Promise<Tables<'staff'> > => {
    try {
      const response = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email ?? undefined,
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update staff: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data as Tables<'staff'>;
    } catch (error) {
      throw new Error(`Unexpected error updating staff: ${error instanceof Error ? error.message : error}`);
    }
  },

  // Back-compat alias that accepts camelCase fields
  updateStaff: async (id: string, data: TablesUpdate<'staff'>): Promise<Tables<'staff'>> => {
    return staffApi.update(id, {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email ?? undefined,
      phone_number: data.phone_number ?? undefined,
      role: data.role,
      status: data.status,
      notes: data.notes ?? undefined,
      office_key_number: (data as unknown as { office_key_number?: number }).office_key_number ?? undefined,
      has_parking_remote: (data as unknown as { has_parking_remote?: 'PHYSICAL' | 'VIRTUAL' | 'NONE' | null }).has_parking_remote ?? undefined,
      availability_monday: (data as unknown as { availability_monday?: boolean | null }).availability_monday,
      availability_tuesday: (data as unknown as { availability_tuesday?: boolean | null }).availability_tuesday,
      availability_wednesday: (data as unknown as { availability_wednesday?: boolean | null }).availability_wednesday,
      availability_thursday: (data as unknown as { availability_thursday?: boolean | null }).availability_thursday,
      availability_friday: (data as unknown as { availability_friday?: boolean | null }).availability_friday,
      availability_saturday_am: (data as unknown as { availability_saturday_am?: boolean | null }).availability_saturday_am,
      availability_saturday_pm: (data as unknown as { availability_saturday_pm?: boolean | null }).availability_saturday_pm,
      availability_sunday_am: (data as unknown as { availability_sunday_am?: boolean | null }).availability_sunday_am,
      availability_sunday_pm: (data as unknown as { availability_sunday_pm?: boolean | null }).availability_sunday_pm,
    });
  },

  // Delete staff - calls server-side API route for admin operations
  delete: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/staff/${id}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete staff: ${response.statusText}`);
    }
    } catch (error) {
      throw new Error(`Unexpected error deleting staff: ${error instanceof Error ? error.message : error}`);
    }
  },

  // Back-compat alias name used by hooks/components
  deleteStaff: async (id: string): Promise<void> => {
    return staffApi.delete(id);
  },

  // Invite a user by email and create the staff record - calls server-side API route
  inviteStaff: async (data: StaffInviteData): Promise<{ staff: Tables<'staff'> }> => {
    if (!data.email || data.email === '') {
      throw new Error('Email is required to invite staff');
    }

    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          role: data.role,
          status: data.status,
          availability_monday: data.availability_monday,
          availability_tuesday: data.availability_tuesday,
          availability_wednesday: data.availability_wednesday,
          availability_thursday: data.availability_thursday,
          availability_friday: data.availability_friday,
          availability_saturday_am: data.availability_saturday_am,
          availability_saturday_pm: data.availability_saturday_pm,
          availability_sunday_am: data.availability_sunday_am,
          availability_sunday_pm: data.availability_sunday_pm,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to invite staff: ${response.statusText}`);
      }

      const result = await response.json();
      return { staff: result.data as Tables<'staff'> };
    } catch (error) {
      throw new Error(`Unexpected error inviting staff: ${error instanceof Error ? error.message : error}`);
    }
  },

  // Create staff account (variant that doesn't require password - for existing users)
  createAccount: async (data: StaffCreateData & { user_id: string }): Promise<Tables<'staff'>> => {
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

    // Update auth user metadata (if user_id is valid)
    if (data.user_id) {
    const { error: authError } = await (getSupabaseClient() as SupabaseClient<Database>).auth.admin.updateUserById(
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
    }

    const { data: staffRecord, error: staffError } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff')
      .insert(staffData)
      .select()
      .single();

    if (staffError) {
      throw new Error(`Failed to create staff record: ${staffError.message}`);
    }

    return staffRecord as Tables<'staff'>;
  },

  // Get all staff (alias for compatibility with hooks)
  getAllStaff: async (): Promise<Tables<'staff'>[]> => {
    return staffApi.getAll();
  },

  // Current logged-in user's staff record
  getCurrentStaff: async (): Promise<Tables<'staff'> | null> => {
    const { data: userData, error } = await (getSupabaseClient() as SupabaseClient<Database>).auth.getUser();
    if (error || !userData.user) return null;
    return staffApi.getByUserId(userData.user.id);
  },

  // Get all staff with their subjects and classes (optimized query)
  getAllStaffWithSubjects: async (): Promise<{ staff: Tables<'staff'>[]; subjects: unknown[]; staffClasses: Record<string, ClassWithExpandedSubject[]>; classSubjects: Record<string, Tables<'subjects'>> }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get all staff with subjects
      const { data: staffData, error: staffError } = await supabase
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

      if (staffError) throw staffError;

      // Get all staff-class assignments with class details and subject information (where unassigned_at IS NULL)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('classes_staff')
        .select(`
          staff_id,
          class:classes(*, subject_details:subjects(*))
        `)
        .is('unassigned_at', null);

      if (assignmentsError) throw assignmentsError;

      // Transform and organize the data
      const staff = (staffData ?? []) as Tables<'staff'>[];
      const staffClasses: Record<string, ClassWithExpandedSubject[]> = {};
      const classSubjects: Record<string, Tables<'subjects'>> = {};

      // Initialize arrays for all staff
      staff.forEach(staffMember => {
        staffClasses[staffMember.id] = [];
      });

      // Process staff classes
      assignmentsData?.forEach((assignment: any) => {
        const classWithSubject = assignment.class as (Tables<'classes'> & { subject_details?: Tables<'subjects'> }) | null;
        if (classWithSubject && assignment.staff_id) {
          if (!staffClasses[assignment.staff_id]) {
            staffClasses[assignment.staff_id] = [];
          }
          const cls: ClassWithExpandedSubject = {
            ...classWithSubject,
            subject: classWithSubject.subject_details
          };
          delete (cls as any).subject_details;
          delete (cls as any).subject; // Remove the string subject field
          if (classWithSubject.subject_details) {
            (cls as any).subject = classWithSubject.subject_details;
          }
          staffClasses[assignment.staff_id].push(cls);
          
          // Store subject by class ID for easy lookup
          if (classWithSubject.subject_details) {
            classSubjects[classWithSubject.id] = classWithSubject.subject_details;
          }
        }
      });

      return {
        staff,
        subjects: [],
        staffClasses,
        classSubjects
      };
    } catch (error) {
      throw new Error(`Failed to fetch staff with subjects and classes: ${error}`);
    }
  },

  // Get staff member with subjects by ID
  getStaffWithSubjects: async (staffId: string) => {
    const { data: staffData, error: staffError } = await (getSupabaseClient() as SupabaseClient<Database>)
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
    const subjects = staffData?.staff_subjects?.map((ss: { subjects: unknown }) => ss.subjects).filter(Boolean) || [];

    return {
      staff: staffData as Tables<'staff'>,
      subjects: subjects
    };
  },

  // Assign subject to staff
  assignSubjectToStaff: async (staffId: string, subjectId: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff_subjects')
      .insert({ staff_id: staffId, subject_id: subjectId });

    if (error) {
      // Ignore duplicate insert
      if (error.code === '23505') return;
      throw new Error(`Failed to assign subject: ${error.message}`);
    }
  },

  // Remove subject from staff
  removeSubjectFromStaff: async (staffId: string, subjectId: string): Promise<void> => {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff_subjects')
      .delete()
      .eq('staff_id', staffId)
      .eq('subject_id', subjectId);

    if (error) {
      throw new Error(`Failed to remove subject: ${error.message}`);
    }
  },

  // Get subjects for a specific staff member
  getStaffSubjects: async (staffId: string) => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('staff_subjects')
      .select(`
        subjects (*)
      `)
      .eq('staff_id', staffId);

    if (error) {
      throw new Error(`Failed to fetch staff subjects: ${error.message}`);
    }

    return data?.map((item: { subjects: unknown }) => item.subjects).filter(Boolean) || [];
  }
}; 