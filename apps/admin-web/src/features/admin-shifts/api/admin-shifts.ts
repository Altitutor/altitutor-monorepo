import type { Json, Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adelaideCalendarDate, clockTime } from '../utils/adminShiftSchedule';
import type {
  AdminShiftSchedulePlan,
  AdminShiftScheduleProposal,
  StoredAdminShiftSchedule,
} from '../types/schedule';

type ScheduleRevisionRow = {
  id: string;
  admin_shift_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: string;
  effective_from: string;
  effective_to: string;
  superseded_at: string | null;
};

async function loadScheduleRevisions(adminShiftIds: string[]): Promise<ScheduleRevisionRow[]> {
  if (adminShiftIds.length === 0) return [];
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('admin_shift_schedule_revisions')
    .select('id, admin_shift_id, day_of_week, start_time, end_time, status, effective_from, effective_to, superseded_at')
    .in('admin_shift_id', adminShiftIds)
    .is('superseded_at', null);
  if (error) throw error;
  return (data ?? []) as ScheduleRevisionRow[];
}

function revisionInForce(revisions: ScheduleRevisionRow[], today: string): ScheduleRevisionRow | undefined {
  return revisions.find((revision) => revision.effective_from <= today && revision.effective_to >= today)
    ?? revisions
      .filter((revision) => revision.effective_from > today)
      .sort((left, right) => left.effective_from.localeCompare(right.effective_from))[0]
    ?? [...revisions].sort((left, right) =>
      right.effective_to.localeCompare(left.effective_to)
      || right.effective_from.localeCompare(left.effective_from)
    )[0];
}

async function overlayInForceSchedules<T extends {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: string;
}>(shifts: T[]): Promise<T[]> {
  const revisions = await loadScheduleRevisions(shifts.map((shift) => shift.id));
  const today = adelaideCalendarDate();
  return shifts.map((shift) => {
    const current = revisionInForce(
      revisions.filter((revision) => revision.admin_shift_id === shift.id),
      today
    );
    if (!current) return shift;
    return {
      ...shift,
      day_of_week: current.day_of_week,
      start_time: clockTime(current.start_time),
      end_time: clockTime(current.end_time),
      status: current.status,
    };
  });
}

async function loadLiveScheduleRevisions(): Promise<ScheduleRevisionRow[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const pageSize = 1000;
  const rows: ScheduleRevisionRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('admin_shift_schedule_revisions')
      .select('id, admin_shift_id, day_of_week, start_time, end_time, status, effective_from, effective_to, superseded_at')
      .is('superseded_at', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as ScheduleRevisionRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function shiftIdsForDisplayedSchedule(days: number[], statuses: string[]): Promise<string[] | null> {
  if (days.length === 0 && statuses.length === 0) return null;
  const today = adelaideCalendarDate();
  const byShift = new Map<string, ScheduleRevisionRow[]>();
  for (const revision of await loadLiveScheduleRevisions()) {
    const group = byShift.get(revision.admin_shift_id) ?? [];
    group.push(revision);
    byShift.set(revision.admin_shift_id, group);
  }
  const ids: string[] = [];
  for (const [adminShiftId, revisions] of byShift) {
    const current = revisionInForce(revisions, today);
    if (!current) continue;
    if (days.length > 0 && !days.includes(current.day_of_week)) continue;
    if (statuses.length > 0 && !statuses.includes(current.status)) continue;
    ids.push(adminShiftId);
  }
  return ids;
}

function mapStoredSchedule(revision: ScheduleRevisionRow): StoredAdminShiftSchedule {
  const status = revision.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return {
    id: revision.id,
    dayOfWeek: revision.day_of_week,
    startTime: clockTime(revision.start_time),
    endTime: clockTime(revision.end_time),
    status,
    effectiveFrom: revision.effective_from,
    effectiveTo: revision.effective_to,
  };
}

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
    return overlayInForceSchedules((data ?? []) as Tables<'admin_shifts'>[]);
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
    statuses?: string[];
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
      statuses = [],
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

    const displayedShiftIds = await shiftIdsForDisplayedSchedule(dayFilters, statuses);
    if (displayedShiftIds?.length === 0) return { adminShifts: [], total: 0 };
    if (displayedShiftIds) {
      query = query.in('id', displayedShiftIds);
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

    // Group staff by admin_shift_id (Supabase returns staff via relationship - type assertion for ambiguous relationship)
    const staffByShift: Record<string, Tables<'staff'>[]> = {};
    type StaffRow = { admin_shift_id: string; staff?: Tables<'staff'> };
    ((staffData || []) as unknown as StaffRow[]).forEach((row) => {
      if (row.staff && row.admin_shift_id) {
        if (!staffByShift[row.admin_shift_id]) {
          staffByShift[row.admin_shift_id] = [];
        }
        staffByShift[row.admin_shift_id].push(row.staff);
      }
    });

    // Transform to MinimalAdminShift format
    const adminShifts = await overlayInForceSchedules(data.map((shift) => ({
      id: shift.id,
      day_of_week: shift.day_of_week,
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: shift.status,
      session_start_date: shift.session_start_date,
      session_end_date: shift.session_end_date,
      staff: staffByShift[shift.id] || [],
    })));

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

      const adminShifts = await overlayInForceSchedules(shiftsData as Tables<'admin_shifts'>[]);
      const adminShiftIds = adminShifts.map((shift) => shift.id);

      // Get staff assignments
      const { data: staffData, error: staffError } = await supabase
        .from('admin_shifts_staff')
        .select('admin_shift_id, staff:staff_id(*)')
        .in('admin_shift_id', adminShiftIds)
        .is('unassigned_at', null);

      if (staffError) throw staffError;

      // Group staff by admin_shift_id (Supabase returns staff via relationship - type assertion for ambiguous relationship)
      const adminShiftStaff: Record<string, Tables<'staff'>[]> = {};
      type StaffRow = { admin_shift_id: string; staff?: Tables<'staff'> };
      ((staffData || []) as unknown as StaffRow[]).forEach((row) => {
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
    staffToAdminShiftStaffId?: Record<string, string>;
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

      const adminShift = (await overlayInForceSchedules([shiftData as Tables<'admin_shifts'>]))[0] ?? shiftData;

      // Get staff assignments with IDs
      const { data: staffData, error: staffError } = await supabase
        .from('admin_shifts_staff')
        .select('id, staff_id, staff:staff_id(*)')
        .eq('admin_shift_id', id)
        .is('unassigned_at', null);

      if (staffError) throw staffError;

      type StaffRowWithId = { id: string; staff_id: string; staff?: Tables<'staff'> };
      const staffRows = (staffData || []) as unknown as StaffRowWithId[];
      const staff = staffRows
        .map((row) => row.staff)
        .filter((s): s is Tables<'staff'> => Boolean(s));
      
      // Map staff IDs to admin_shifts_staff IDs for removal
      const staffToAdminShiftStaffId: Record<string, string> = {};
      staffRows.forEach((row) => {
        if (row.staff_id && row.id) {
          staffToAdminShiftStaffId[row.staff_id] = row.id;
        }
      });

      // Get sessions (optional, for sessions tab)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('admin_shift_id', id)
        .eq('status', 'ACTIVE')
        .is('calendar_tombstone_until', null)
        .order('start_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      const sessions = (sessionsData || []) as Tables<'sessions'>[];

      return {
        adminShift,
        staff,
        sessions,
        staffToAdminShiftStaffId,
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

  listSchedule: async (adminShiftId: string): Promise<StoredAdminShiftSchedule[]> => {
    const revisions = await loadScheduleRevisions([adminShiftId]);
    return revisions
      .map(mapStoredSchedule)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  },

  previewSchedule: async (proposal: AdminShiftScheduleProposal): Promise<AdminShiftSchedulePlan> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc('preview_admin_shift_schedule', {
      p_proposal: proposal as unknown as Json,
    });
    if (error) throw error;
    return data as unknown as AdminShiftSchedulePlan;
  },

  applySchedule: async (
    proposal: AdminShiftScheduleProposal,
    expectedProposalHash: string
  ): Promise<AdminShiftSchedulePlan> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc('apply_admin_shift_schedule', {
      p_proposal: proposal as unknown as Json,
      p_expected_proposal_hash: expectedProposalHash,
    });
    if (error) throw error;
    return data as unknown as AdminShiftSchedulePlan;
  },
};
