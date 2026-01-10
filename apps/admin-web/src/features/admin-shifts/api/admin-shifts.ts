import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type MinimalAdminShift = Pick<
  Tables<'admin_shifts'>,
  'id' | 'day_of_week' | 'start_time' | 'end_time' | 'status' | 'session_start_date' | 'session_end_date'
> & {
  staff?: Tables<'staff'>[];
};

/**
 * Admin Shifts API client for working with admin shift data
 */
export const adminShiftsApi = {
  /**
   * Get all admin shifts
   */
  getAllAdminShifts: async (): Promise<Tables<'admin_shifts'>[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('admin_shifts')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Tables<'admin_shifts'>[];
  },

  /**
   * Minimal fields for table display only
   * Returns: id, day_of_week, start_time, end_time, status
   * WITH: staff assignments
   */
  listMinimal: async (params?: {
    search?: string;
    dayOfWeek?: number | number[];
    daysOfWeek?: number[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'admin_shifts'>;
    ascending?: boolean;
  }): Promise<{
    adminShifts: MinimalAdminShift[];
    total: number;
  }> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const {
      search = '',
      dayOfWeek,
      daysOfWeek = [],
      limit = 50,
      offset = 0,
      orderBy = 'day_of_week',
      ascending = true,
    } = params || {};

    const trimmed = search.trim();
    const dayFilters = Array.isArray(dayOfWeek)
      ? dayOfWeek
      : daysOfWeek.length > 0
        ? daysOfWeek
        : dayOfWeek !== undefined
          ? [dayOfWeek]
          : [];

    // Build query
    let query = supabase
      .from('admin_shifts')
      .select('*', { count: 'exact' });

    // Apply filters
    if (dayFilters.length > 0) {
      query = query.in('day_of_week', dayFilters);
    }

    if (trimmed.length > 0) {
      // Simple text search on start_time/end_time (could be enhanced with full-text search)
      query = query.or(`start_time.ilike.%${trimmed}%,end_time.ilike.%${trimmed}%`);
    }

    // Apply ordering
    query = query.order(orderBy as string, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    if (!data) return { adminShifts: [], total: 0 };

    // Get staff assignments for each admin shift
    const adminShiftIds = data.map((shift) => shift.id);
    const { data: staffData, error: staffError } = await supabase
      .from('admin_shifts_staff')
      .select('admin_shift_id, staff:staff_id(*)')
      .in('admin_shift_id', adminShiftIds)
      .is('unassigned_at', null);

    if (staffError) throw staffError;

    // Group staff by admin_shift_id
    const staffByShift: Record<string, Tables<'staff'>[]> = {};
    (staffData || []).forEach((row: any) => {
      if (row.staff && row.admin_shift_id) {
        if (!staffByShift[row.admin_shift_id]) {
          staffByShift[row.admin_shift_id] = [];
        }
        staffByShift[row.admin_shift_id].push(row.staff);
      }
    });

    // Transform to MinimalAdminShift format
    const adminShifts: MinimalAdminShift[] = data.map((shift) => ({
      id: shift.id,
      day_of_week: shift.day_of_week,
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: shift.status,
      session_start_date: shift.session_start_date,
      session_end_date: shift.session_end_date,
      staff: staffByShift[shift.id] || [],
    }));

    return {
      adminShifts,
      total: count ?? 0,
    };
  },

  /**
   * Get all admin shifts with their associated staff
   */
  getAllAdminShiftsWithDetails: async (): Promise<{
    adminShifts: Tables<'admin_shifts'>[];
    adminShiftStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    try {
      // Get all admin shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('admin_shifts')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (shiftsError) throw shiftsError;
      if (!shiftsData) return { adminShifts: [], adminShiftStaff: {} };

      const adminShifts = shiftsData as Tables<'admin_shifts'>[];
      const adminShiftIds = adminShifts.map((shift) => shift.id);

      // Get staff assignments
      const { data: staffData, error: staffError } = await supabase
        .from('admin_shifts_staff')
        .select('admin_shift_id, staff:staff_id(*)')
        .in('admin_shift_id', adminShiftIds)
        .is('unassigned_at', null);

      if (staffError) throw staffError;

      // Group staff by admin_shift_id
      const adminShiftStaff: Record<string, Tables<'staff'>[]> = {};
      (staffData || []).forEach((row: any) => {
        if (row.staff && row.admin_shift_id) {
          if (!adminShiftStaff[row.admin_shift_id]) {
            adminShiftStaff[row.admin_shift_id] = [];
          }
          adminShiftStaff[row.admin_shift_id].push(row.staff);
        }
      });

      return {
        adminShifts,
        adminShiftStaff,
      };
    } catch (error) {
      console.error('Error getting admin shifts with details:', error);
      throw error;
    }
  },

  /**
   * Get a single admin shift with its details
   */
  getAdminShiftById: async (id: string): Promise<{
    adminShift: Tables<'admin_shifts'>;
    staff: Tables<'staff'>[];
    sessions?: Tables<'sessions'>[];
  }> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    try {
      // Get admin shift
      const { data: shiftData, error: shiftError } = await supabase
        .from('admin_shifts')
        .select('*')
        .eq('id', id)
        .single();

      if (shiftError) throw shiftError;
      if (!shiftData) throw new Error('Admin shift not found');

      const adminShift = shiftData as Tables<'admin_shifts'>;

      // Get staff assignments
      const { data: staffData, error: staffError } = await supabase
        .from('admin_shifts_staff')
        .select('staff:staff_id(*)')
        .eq('admin_shift_id', id)
        .is('unassigned_at', null);

      if (staffError) throw staffError;

      const staff = ((staffData || []) as any[])
        .map((row) => row.staff)
        .filter(Boolean) as Tables<'staff'>[];

      // Get sessions (optional, for sessions tab)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('admin_shift_id', id)
        .order('start_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      const sessions = (sessionsData || []) as Tables<'sessions'>[];

      return {
        adminShift,
        staff,
        sessions,
      };
    } catch (error) {
      console.error('Error getting admin shift by id:', error);
      throw error;
    }
  },

  /**
   * Create a new admin shift
   */
  createAdminShift: async (adminShift: TablesInsert<'admin_shifts'>): Promise<Tables<'admin_shifts'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('admin_shifts')
      .insert(adminShift)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'admin_shifts'>;
  },

  /**
   * Update an admin shift
   */
  updateAdminShift: async (
    id: string,
    updates: TablesUpdate<'admin_shifts'>
  ): Promise<Tables<'admin_shifts'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('admin_shifts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'admin_shifts'>;
  },

  /**
   * Delete an admin shift
   */
  deleteAdminShift: async (id: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase.from('admin_shifts').delete().eq('id', id);

    if (error) throw error;
  },

  /**
   * Assign staff to an admin shift
   */
  assignStaff: async (
    adminShiftId: string,
    staffId: string,
    createdBy?: string
  ): Promise<Tables<'admin_shifts_staff'>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('admin_shifts_staff')
      .insert({
        admin_shift_id: adminShiftId,
        staff_id: staffId,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Tables<'admin_shifts_staff'>;
  },

  /**
   * Unassign staff from an admin shift
   */
  unassignStaff: async (adminShiftStaffId: string): Promise<void> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase
      .from('admin_shifts_staff')
      .update({ unassigned_at: new Date().toISOString() })
      .eq('id', adminShiftStaffId);

    if (error) throw error;
  },
};
