import type { Tables, TablesInsert, TablesUpdate, Database, ClassWithExpandedSubject, Json } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import type { ClassSchedulePlan, ClassScheduleProposal, StoredClassSchedule } from '../types/schedule';

type ScheduleRevisionWithSlots = Tables<'class_schedule_revisions'> & {
  class_schedule_slots: Tables<'class_schedule_slots'>[];
};

function mapStoredClassSchedule(data: ScheduleRevisionWithSlots): StoredClassSchedule {
  return {
    id: data.id,
    scheduleType: data.schedule_type as 'RECURRING' | 'CUSTOM',
    billingType: data.billing_type,
    frequencyWeeks: data.frequency_weeks as 1 | 2 | null,
    anchorDate: data.anchor_date,
    effectiveFrom: data.effective_from,
    effectiveTo: data.effective_to,
    rows: [...data.class_schedule_slots]
      .sort((left, right) => left.position - right.position)
      .map((row) => ({
        id: row.id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        room: row.room ?? '',
      })),
  };
}

export type MinimalClass = Pick<
  Tables<'classes'>,
  'id' | 'day_of_week' | 'start_time' | 'end_time' | 'status' | 'room' | 'subject_id' | 'level' | 'short_name' | 'long_name' | 'schedule_summary_short' | 'schedule_summary_long' | 'schedule_weekdays' | 'schedule_rows' | 'schedule_frequency_weeks' | 'schedule_anchor_date' | 'next_session_start_at' | 'billing_type' | 'billing_type_effective_from'
> & {
  subject?: Tables<'subjects'> | null;
  studentCount?: number;
  students?: Tables<'students'>[];
  staff?: Tables<'staff'>[];
};

export type ClassStudent = Tables<'students'> & { enrolled_at: string };
export type ClassStaff = Tables<'staff'> & { assigned_at: string };

export interface ClassDeleteImpact {
  futureSessionCount: number;
  historicalSessionCount: number;
  protectedFutureSessionCount: number;
  canDelete: boolean;
}

/**
 * Classes API client for working with class data
 */
export const classesApi = {
  getLatestSchedule: async (classId: string): Promise<StoredClassSchedule | null> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from('class_schedule_revisions')
      .select('id, class_id, schedule_type, billing_type, frequency_weeks, anchor_date, effective_from, effective_to, created_at, created_by, superseded_at, class_schedule_slots(id, schedule_revision_id, day_of_week, start_time, end_time, room, position, created_at)')
      .eq('class_id', classId)
      .is('superseded_at', null)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapStoredClassSchedule(data as ScheduleRevisionWithSlots);
  },

  getScheduleTimeline: async (classId: string): Promise<StoredClassSchedule[]> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Adelaide',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const { data, error } = await supabase
      .from('class_schedule_revisions')
      .select('id, class_id, schedule_type, billing_type, frequency_weeks, anchor_date, effective_from, effective_to, created_at, created_by, superseded_at, class_schedule_slots(id, schedule_revision_id, day_of_week, start_time, end_time, room, position, created_at)')
      .eq('class_id', classId)
      .is('superseded_at', null)
      .gte('effective_to', today)
      .order('effective_from', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ScheduleRevisionWithSlots[]).map(mapStoredClassSchedule);
  },

  previewSchedule: async (proposal: ClassScheduleProposal): Promise<ClassSchedulePlan> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc('preview_class_schedule', {
      p_proposal: proposal as unknown as Json,
    });
    if (error) throw error;
    return data as unknown as ClassSchedulePlan;
  },

  applySchedule: async (
    proposal: ClassScheduleProposal,
    expectedProposalHash: string
  ): Promise<ClassSchedulePlan> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc('apply_class_schedule', {
      p_proposal: proposal as unknown as Json,
      p_expected_proposal_hash: expectedProposalHash,
    });
    if (error) throw error;
    return data as unknown as ClassSchedulePlan;
  },

  /**
   * Get all classes
   */
  getAllClasses: async (): Promise<Tables<'classes'>[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('classes')
      .select('id, subject_id, day_of_week, start_time, end_time, status, room');
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
  
  /**
   * Minimal fields for table display only
   * Returns: id, name, day_of_week, start_time, end_time, level, room
   * WITH: subject(name, discipline, curriculum)
   * WITH: student count only (not full student records)
   */
  listMinimal: async (params?: {
    search?: string;
    subjectIds?: string[];
    studentIds?: string[];
    staffIds?: string[];
    dayOfWeek?: number | number[];
    daysOfWeek?: number[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'classes'>;
    ascending?: boolean;
    excludeStudentSearch?: boolean;
    excludeStaffSearch?: boolean;
  }): Promise<{
    classes: MinimalClass[];
    total: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const {
      search = '',
      subjectIds,
      studentIds,
      staffIds,
      dayOfWeek,
      daysOfWeek = [],
      limit = 50,
      offset = 0,
      orderBy = 'day_of_week',
      ascending = true,
      excludeStudentSearch = false,
      excludeStaffSearch = false,
    } = params || {};

    const trimmed = search.trim();
    const dayFilters = Array.isArray(dayOfWeek)
      ? dayOfWeek
      : daysOfWeek.length > 0
        ? daysOfWeek
        : dayOfWeek !== undefined
          ? [dayOfWeek]
          : [];

    // Always use RPC function (supports both search and "get all" when search is empty)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_statuses: ['ACTIVE'],
      p_subject_ids: subjectIds && subjectIds.length > 0 ? subjectIds : undefined,
      p_student_ids: studentIds && studentIds.length > 0 ? studentIds : undefined,
      p_staff_ids: staffIds && staffIds.length > 0 ? staffIds : undefined,
      p_include_relationships: true,
      p_exclude_student_search: excludeStudentSearch,
      p_exclude_staff_search: excludeStaffSearch,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy as string,
      p_ascending: ascending,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { classes: [], total: 0 };

    interface RpcClassRow {
      id: string;
      day_of_week?: number;
      start_time?: string;
      end_time?: string;
      status?: string;
      room?: string | null;
      subject_id?: string | null;
      level?: string | null;
      short_name?: string | null;
      long_name?: string | null;
      schedule_summary_short?: string | null;
      schedule_summary_long?: string | null;
      schedule_weekdays?: number[];
      schedule_rows?: Json;
      schedule_frequency_weeks?: number | null;
      schedule_anchor_date?: string | null;
      next_session_start_at?: string | null;
      billing_type: Tables<'classes'>['billing_type'];
      billing_type_effective_from: string;
    }
    const rpcData = rpcResult as unknown as {
      classes: RpcClassRow[];
      classSubjects: Record<string, Tables<'subjects'>>;
      classStudents: Record<string, Tables<'students'>[]>;
      classStaff: Record<string, Tables<'staff'>[]>;
      total: number;
    };
    let classes = rpcData.classes || [];

    // Apply day filter that RPC doesn't support
    if (dayFilters.length > 0) {
      classes = classes.filter((c) =>
        (c.schedule_weekdays ?? (c.day_of_week === undefined ? [] : [c.day_of_week]))
          .some((day) => dayFilters.includes(day))
      );
    }

    // Transform RPC response to match expected format
    const transformedClasses = classes.map((cls) => {
      const subject = rpcData.classSubjects?.[cls.id] || null;
      const students = rpcData.classStudents?.[cls.id] || [];
      const staff = rpcData.classStaff?.[cls.id] || [];
      
      return {
        id: cls.id,
        day_of_week: cls.day_of_week,
        start_time: cls.start_time,
        end_time: cls.end_time,
        status: cls.status,
        room: cls.room,
        subject_id: cls.subject_id,
        level: cls.level,
        short_name: cls.short_name ?? null,
        long_name: cls.long_name ?? null,
        schedule_summary_short: cls.schedule_summary_short ?? null,
        schedule_summary_long: cls.schedule_summary_long ?? null,
        schedule_weekdays: cls.schedule_weekdays ?? (cls.day_of_week === undefined ? [] : [cls.day_of_week]),
        schedule_rows: cls.schedule_rows ?? [],
        schedule_frequency_weeks: cls.schedule_frequency_weeks ?? null,
        schedule_anchor_date: cls.schedule_anchor_date ?? null,
        next_session_start_at: cls.next_session_start_at ?? null,
        billing_type: cls.billing_type,
        billing_type_effective_from: cls.billing_type_effective_from,
        subject,
        studentCount: students.length,
        students,
        staff,
      };
    }) as MinimalClass[];

    // Use RPC total for pagination (client-side filters reduce visible items but don't affect total count for pagination)
    // Note: If client-side filters are applied, the actual filtered total may be lower, but we use RPC total
    // to maintain correct pagination. The UI will show fewer items on some pages due to filtering.
    const total = rpcData.total;

    return {
      classes: transformedClasses,
      total,
    };
  },
  
  /**
   * Get all classes with their associated subject, students, and staff using RPC function
   * This solves the N+1 query problem for the classes table
   */
  getAllClassesWithDetails: async (): Promise<{ 
    classes: Tables<'classes'>[]; 
    classSubjects: Record<string, Tables<'subjects'>>;
    classStudents: Record<string, Tables<'students'>[]>; 
    classStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Use RPC function to get all classes (no search term, very high limit)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
        p_search: undefined,
        p_statuses: undefined, // Get all statuses
        p_include_relationships: true,
        p_exclude_student_search: false,
        p_exclude_staff_search: false,
        p_limit: 10000, // High limit to get all classes
        p_offset: 0,
        p_order_by: 'day_of_week',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return { classes: [], classSubjects: {}, classStudents: {}, classStaff: {} };
      
      interface RpcClassRow {
        id: string;
        day_of_week?: number;
        start_time?: string;
        end_time?: string;
        status?: string;
        room?: string | null;
        subject_id?: string | null;
        level?: string | null;
        short_name?: string | null;
        long_name?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
        billing_type: Tables<'classes'>['billing_type'];
        billing_type_effective_from: string;
      }
      const rpcData = rpcResult as unknown as {
        classes: RpcClassRow[];
        classSubjects: Record<string, Tables<'subjects'>>;
        classStudents: Record<string, Tables<'students'>[]>;
        classStaff: Record<string, Tables<'staff'>[]>;
        total: number;
      };

      const rpcClasses = rpcData.classes || [];
      
      // Transform RPC response to match expected format
      const classes: Tables<'classes'>[] = [];
      const classSubjects: Record<string, Tables<'subjects'>> = {};
      const classStudents: Record<string, Tables<'students'>[]> = {};
      const classStaff: Record<string, Tables<'staff'>[]> = {};
      
      rpcClasses.forEach((cls) => {
        // Build class object
        const classData: Tables<'classes'> = {
          id: cls.id,
          day_of_week: cls.day_of_week,
          start_time: cls.start_time,
          end_time: cls.end_time,
          status: cls.status,
          room: cls.room || null,
          subject_id: cls.subject_id || null,
          level: cls.level || null,
          short_name: cls.short_name ?? null,
          long_name: cls.long_name ?? null,
          created_at: cls.created_at || null,
          updated_at: cls.updated_at || null,
          billing_type: cls.billing_type,
          billing_type_effective_from: cls.billing_type_effective_from,
        } as Tables<'classes'>;
        
        classes.push(classData);
        
        // Add subject if available
        if (rpcData.classSubjects?.[cls.id]) {
          classSubjects[cls.id] = rpcData.classSubjects[cls.id] as Tables<'subjects'>;
        }
        
        // Add students if available
        if (rpcData.classStudents?.[cls.id]) {
          classStudents[cls.id] = (rpcData.classStudents[cls.id] || []) as Tables<'students'>[];
        } else {
          classStudents[cls.id] = [];
        }
        
        // Add staff if available
        if (rpcData.classStaff?.[cls.id]) {
          classStaff[cls.id] = (rpcData.classStaff[cls.id] || []) as Tables<'staff'>[];
        } else {
          classStaff[cls.id] = [];
        }
      });
      
      return {
        classes,
        classSubjects,
        classStudents,
        classStaff
      };
      
    } catch (error) {
      console.error('Error getting classes with details:', error);
      throw error;
    }
  },

  /**
   * Get a student's class enrollments, including previous (unenrolled) ones.
   */
  getStudentClassEnrollments: async (studentId: string): Promise<Array<{
    class: Tables<'classes'>;
    subject?: Tables<'subjects'>;
    staff: Tables<'staff'>[];
    students: Tables<'students'>[];
    enrollment: Tables<'classes_students'>;
  }>> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const nowIso = new Date().toISOString();

    type EnrollmentRow = Tables<'classes_students'> & {
      class: (Tables<'classes'> & { subject_details?: Tables<'subjects'> | null }) | null;
    };
    type StaffRow = { class_id: string; staff: Tables<'staff'> | null };
    type StudentRow = { class_id: string; student: Tables<'students'> | null };

    const { data: enrollmentRows, error: enrollmentsError } = await supabase
      .from('classes_students')
      .select(`
        id,
        class_id,
        student_id,
        enrolled_at,
        enrolled_by,
        unenrolled_at,
        unenrolled_by,
        created_at,
        created_by,
        updated_at,
        class:classes(
          *,
          subject_details:subjects(*)
        )
      `)
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false });

    if (enrollmentsError) throw enrollmentsError;

    const enrollments = (enrollmentRows ?? []) as EnrollmentRow[];
    const classIds = [...new Set(
      enrollments
        .map((row) => row.class?.id)
        .filter((id): id is string => Boolean(id))
    )];

    const classStaff: Record<string, Tables<'staff'>[]> = {};
    const classStudents: Record<string, Tables<'students'>[]> = {};
    for (const classId of classIds) {
      classStaff[classId] = [];
      classStudents[classId] = [];
    }

    if (classIds.length > 0) {
      const [{ data: staffRows, error: staffError }, { data: studentRows, error: studentsError }] =
        await Promise.all([
          supabase
            .from('classes_staff')
            .select('class_id, staff:staff!class_assignments_staff_id_fkey(*)')
            .in('class_id', classIds)
            .is('unassigned_at', null),
          supabase
            .from('classes_students')
            .select('class_id, student:students(*)')
            .in('class_id', classIds)
            .or(`unenrolled_at.is.null,unenrolled_at.gt.${nowIso}`),
        ]);

      if (staffError) throw staffError;
      if (studentsError) throw studentsError;

      ((staffRows ?? []) as StaffRow[]).forEach((row) => {
        if (row.staff && row.class_id) {
          classStaff[row.class_id] = classStaff[row.class_id] ?? [];
          classStaff[row.class_id].push(row.staff);
        }
      });

      ((studentRows ?? []) as StudentRow[]).forEach((row) => {
        if (row.student && row.class_id) {
          classStudents[row.class_id] = classStudents[row.class_id] ?? [];
          classStudents[row.class_id].push(row.student);
        }
      });
    }

    return enrollments.flatMap((row) => {
      if (!row.class) return [];
      const { subject_details, ...classBase } = row.class;
      return [{
        class: classBase,
        subject: subject_details ?? undefined,
        staff: classStaff[classBase.id] ?? [],
        students: classStudents[classBase.id] ?? [],
        enrollment: {
          id: row.id,
          class_id: row.class_id,
          student_id: row.student_id,
          enrolled_at: row.enrolled_at,
          enrolled_by: row.enrolled_by,
          unenrolled_at: row.unenrolled_at,
          unenrolled_by: row.unenrolled_by,
          created_at: row.created_at,
          created_by: row.created_by,
          updated_at: row.updated_at,
        },
      }];
    });
  },

  /**
   * Get classes with details for a specific staff member (via classes_staff)
   */
  getClassesForStaffWithDetails: async (staffId: string): Promise<{ 
    classes: Tables<'classes'>[]; 
    classSubjects: Record<string, Tables<'subjects'>>;
    classStudents: Record<string, Tables<'students'>[]>; 
    classStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    type ClassRowWithSubject = Tables<'classes'> & { subject_details?: Tables<'subjects'> };
    type EnrollmentRow = { class_id: string; student: Tables<'students'> | null };
    type AssignmentRow = { class_id: string; staff: Tables<'staff'> | null };
    
    try {
      // Get class ids for the staff member (where unassigned_at IS NULL)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('classes_staff')
        .select('class_id')
        .eq('staff_id', staffId)
        .is('unassigned_at', null);
      if (assignmentError) throw assignmentError;
      const assignmentRows: Array<{ class_id: string }> = (assignmentData ?? []) as Array<{ class_id: string }>;
      const classIds = assignmentRows.map((r) => r.class_id);
      if (!classIds.length) {
        return { classes: [], classSubjects: {}, classStudents: {}, classStaff: {} };
      }

      // Fetch only those classes with subject
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id, subject_id, day_of_week, start_time, end_time, status, room,
          subject_details:subjects(*)
        `)
        .in('id', classIds);
      if (classesError) throw classesError;

      // Enrollments for those classes (current and future enrollments)
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          student:students(*)
        `)
        .in('class_id', classIds)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      if (enrollmentsError) throw enrollmentsError;

      // Staff for those classes (where unassigned_at IS NULL)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('classes_staff')
        .select(`
          class_id,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .in('class_id', classIds)
        .is('unassigned_at', null);
      if (assignmentsError) throw assignmentsError;

      // Transform
      const classes: Tables<'classes'>[] = [];
      const classSubjects: Record<string, Tables<'subjects'>> = {};
      const classStudents: Record<string, Tables<'students'>[]> = {};
      const classStaff: Record<string, Tables<'staff'>[]> = {};

      (classesData as ClassRowWithSubject[] | null)?.forEach((row) => {
        const cls = row as Tables<'classes'>;
        classes.push(cls);
        if (row.subject_details) {
          classSubjects[cls.id] = row.subject_details as Tables<'subjects'>;
        }
        classStudents[cls.id] = [];
        classStaff[cls.id] = [];
      });

      (enrollmentsData as EnrollmentRow[] | null)?.forEach((row) => {
        if (row.student && row.class_id) {
          if (!classStudents[row.class_id]) classStudents[row.class_id] = [];
          classStudents[row.class_id].push(row.student);
        }
      });

      (assignmentsData as AssignmentRow[] | null)?.forEach((row) => {
        if (row.staff && row.class_id) {
          if (!classStaff[row.class_id]) classStaff[row.class_id] = [];
          classStaff[row.class_id].push(row.staff);
        }
      });

      return { classes, classSubjects, classStudents, classStaff };
    } catch (error) {
      console.error('Error getting classes for staff with details:', error);
      throw error;
    }
  },

  /**
   * Lightweight aggregates for dashboard
   */
  getAggregates: async (): Promise<{
    totalClasses: number;
    totalClassEnrollments: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);

    const [
      { count: classesCount, error: classesErr },
      { count: enrollmentsCount, error: enrollErr },
    ] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase
        .from('classes_students')
        .select('class_id', { count: 'exact', head: true })
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`),
    ]);

    if (classesErr) throw classesErr;
    if (enrollErr) throw enrollErr;

    return {
      totalClasses: classesCount ?? 0,
      totalClassEnrollments: enrollmentsCount ?? 0,
    };
  },
  
  /**
   * Get a single class with its details
   */
  getClassWithDetails: async (classId: string): Promise<{
    class: Tables<'classes'> | null;
    subject: Tables<'subjects'> | null;
    students: ClassStudent[];
    staff: ClassStaff[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get class with subject
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          subject_details:subjects(*)
        `)
        .eq('id', classId)
        .single();
      
      if (classError) {
        if (classError.code === 'PGRST116') {
          return { class: null, subject: null, students: [], staff: [] };
        }
        throw classError;
      }
      
      // Get students for this class (current and future enrollments)
      const { data: studentsData, error: studentsError } = await supabase
        .from('classes_students')
        .select(`
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          student:students(*)
        `)
        .eq('class_id', classId)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      
      if (studentsError) throw studentsError;
      
      // Get staff for this class
      const { data: staffData, error: staffError } = await supabase
        .from('classes_staff')
        .select(`
          assigned_at,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .eq('class_id', classId)
        .is('unassigned_at', null);
      
      if (staffError) throw staffError;
      
      // Transform the data
      const cls = classData as Tables<'classes'>;
      const subject = (classData as { subject_details?: Tables<'subjects'> } | null)?.subject_details ?? null;
      const students = ((studentsData as Array<{ enrolled_at: string; student: Tables<'students'> | null }> | null) ?? [])
        .filter((row): row is { enrolled_at: string; student: Tables<'students'> } => row.student != null)
        .map((row) => ({ ...row.student, enrolled_at: row.enrolled_at }));
      const staffRows: Array<{ assigned_at: string; staff: Tables<'staff'> | null }> = staffData ? ((staffData as unknown) as Array<{ assigned_at: string; staff: Tables<'staff'> | null }>) : [];
      const staff = staffRows
        .filter((row): row is { assigned_at: string; staff: Tables<'staff'> } => row.staff != null)
        .map((row) => ({ ...row.staff, assigned_at: row.assigned_at }));
      
      return { class: cls, subject, students, staff };
      
    } catch (error) {
      console.error('Error getting class with details:', error);
      throw error;
    }
  },
  
  /**
   * Get full class details for modal view
   * Returns: class, subject, students (with subjects), staff, upcoming sessions
   */
  getClassDetails: async (classId: string): Promise<{
    class: Tables<'classes'> | null;
    subject: Tables<'subjects'> | null;
    students: (ClassStudent & { subjects?: Tables<'subjects'>[] })[];
    staff: ClassStaff[];
    upcomingSessions: Tables<'sessions'>[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get base class details
      const baseDetails = await classesApi.getClassWithDetails(classId);
      
      if (!baseDetails.class) {
        return {
          class: null,
          subject: null,
          students: [],
          staff: [],
          upcomingSessions: [],
        };
      }

      // Get student subjects for enrolled students
      const studentIds = baseDetails.students.map(s => s.id);
      const studentSubjectsMap: Record<string, Tables<'subjects'>[]> = {};
      
      if (studentIds.length > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('students_subjects')
          .select('student_id, subject_details:subjects(*)')
          .in('student_id', studentIds);
        
        if (subjectsError) throw subjectsError;
        
        studentIds.forEach(id => {
          studentSubjectsMap[id] = [];
        });
        
        (subjectsData ?? []).forEach((row: { student_id?: string; subject_details?: Tables<'subjects'> | null }) => {
          const sid = row.student_id;
          const subj = row.subject_details;
          if (sid && subj && sid in studentSubjectsMap) {
            studentSubjectsMap[sid].push(subj);
          }
        });
      }

      // Get upcoming sessions for this class (next 5)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', classId)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(5);
      
      if (sessionsError) throw sessionsError;

      // Combine students with their subjects
      const studentsWithSubjects = baseDetails.students.map(student => ({
        ...student,
        subjects: studentSubjectsMap[student.id] || [],
      }));

      return {
        class: baseDetails.class,
        subject: baseDetails.subject,
        students: studentsWithSubjects,
        staff: baseDetails.staff,
        upcomingSessions: (sessionsData ?? []) as Tables<'sessions'>[],
      };
    } catch (error) {
      console.error('Error getting class details:', error);
      throw error;
    }
  },
  
  /**
   * Get a class by ID
   */
  getClass: async (id: string): Promise<Tables<'classes'> | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase.from('classes').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'classes'> | null;
  },
  
  /**
   * Create a new class
   */
  createClass: async (data: TablesInsert<'classes'>): Promise<Tables<'classes'>> => {
    const payload: TablesInsert<'classes'> = data;
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: created, error } = await supabase.from('classes').insert(payload).select().single();
    if (error) throw error;
    return created as Tables<'classes'>;
  },
  
  /**
   * Update a class
   */
  updateClass: async (id: string, data: TablesUpdate<'classes'>): Promise<Tables<'classes'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: updated, error } = await supabase.from('classes').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated as Tables<'classes'>;
  },
  
  /**
   * Delete a class
   */
  deleteClass: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },

  getDeleteImpact: async (id: string): Promise<ClassDeleteImpact> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc('preview_class_deletion', { p_class_id: id });
    if (error) throw error;
    const impact = data as {
      future_session_count: number;
      historical_session_count: number;
      protected_future_session_count: number;
      can_delete: boolean;
    };
    return {
      futureSessionCount: impact.future_session_count,
      historicalSessionCount: impact.historical_session_count,
      protectedFutureSessionCount: impact.protected_future_session_count,
      canDelete: impact.can_delete,
    };
  },
  
  /**
   * Get all students enrolled in a class (current and future enrollments)
   */
  getClassStudents: async (classId: string): Promise<Tables<'students'>[]> => {
    try {
      // Get current and future class enrollments for this class
      const { data: enrollments, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('classes_students')
        .select('student:students(*), class_id, enrolled_at, enrolled_by, unenrolled_at, unenrolled_by')
        .eq('class_id', classId)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      if (error) throw error;
      
      if (!((enrollments as Array<{ student: Tables<'students'> | null }> | null) ?? []).length) {
        return [];
      }
      
      // Map enrolled rows to student objects
      return ((enrollments as Array<{ student: Tables<'students'> | null }>) || [])
        .map((enrollment) => enrollment.student)
        .filter(Boolean) as Tables<'students'>[];
    } catch (error) {
      console.error('Error getting class students:', error);
      throw error;
    }
  },
  
  /**
   * Get all staff assigned to a class
   */
  getClassStaff: async (classId: string): Promise<Tables<'staff'>[]> => {
    try {
      // Get all class assignments for this class (where unassigned_at IS NULL)
      // Use the correct foreign key hint: class_assignments_staff_id_fkey (the main staff_id relationship)
      const { data: assignments, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('classes_staff')
        .select('staff:staff!class_assignments_staff_id_fkey(*), class_id')
        .eq('class_id', classId)
        .is('unassigned_at', null);
      if (error) throw error;
      
      // Filter for active assignments
      if (!(assignments ?? []).length) {
        return [];
      }
      const assignmentRows: Array<{ staff: Tables<'staff'> | null }> = assignments ? ((assignments as unknown) as Array<{ staff: Tables<'staff'> | null }>) : [];
      return assignmentRows
        .map((row) => row.staff)
        .filter(Boolean) as Tables<'staff'>[];
    } catch (error) {
      // Log error but don't throw - this is a non-critical operation
      // The session modal can still function without class staff info
      console.warn('Could not get class staff (non-critical):', error);
      return [];
    }
  },
  
  /**
   * Enroll a student in a class
   */
  enrollStudent: async (
    classId: string, 
    studentId: string, 
    enrolledAt: Date, 
    staffId: string
  ): Promise<Tables<'classes_students'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Use RPC function for enrollment with status validation
      const { data: enrollmentId, error: rpcError } = await supabase.rpc('enroll_student_in_class', {
        p_class_id: classId,
        p_student_id: studentId,
        p_enrolled_at: enrolledAt.toISOString(),
        p_enrolled_by: staffId,
      });
      
      if (rpcError) throw rpcError;
      if (!enrollmentId) throw new Error('Enrollment failed: no enrollment ID returned');
      
      // Fetch the created enrollment record
      const { data, error } = await supabase
        .from('classes_students')
        .select()
        .eq('id', enrollmentId)
        .single();
      
      if (error) throw error;
      return data as Tables<'classes_students'>;
    } catch (error) {
      console.error('Error enrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Remove a student from a class (immediate or scheduled future unenrollment)
   */
  unenrollStudent: async (
    classId: string, 
    studentId: string, 
    staffId: string, 
    unenrolledAt?: Date
  ): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { error } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: (unenrolledAt || new Date()).toISOString(),
          unenrolled_by: staffId 
        })
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null);
      if (error) throw error;
    } catch (error) {
      console.error('Error unenrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Update enrollment date for a future enrollment
   */
  updateEnrollmentDate: async (
    classId: string,
    studentId: string,
    newEnrolledAt: Date,
    staffId: string
  ): Promise<Tables<'classes_students'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // First check if the enrollment is in the future
      const { data: existing, error: fetchError } = await supabase
        .from('classes_students')
        .select('enrolled_at')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!existing) throw new Error('Enrollment not found');
      
      const enrolledAt = new Date(existing.enrolled_at);
      if (enrolledAt <= new Date()) {
        throw new Error('Cannot update enrollment date for enrollments that have already started');
      }
      
      // Update the enrollment date
      const { data, error } = await supabase
        .from('classes_students')
        .update({ 
          enrolled_at: newEnrolledAt.toISOString(),
          enrolled_by: staffId 
        })
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null)
        .select()
        .single();
      
      if (error) throw error;
      return data as Tables<'classes_students'>;
    } catch (error) {
      console.error('Error updating enrollment date:', error);
      throw error;
    }
  },

  /**
   * Change a student from one class to another atomically
   * This unenrolls from the old class and enrolls in the new class in a single operation
   */
  changeClass: async (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get the enrollment record with enrolled_at
      const { data: oldEnrollment, error: fetchError } = await supabase
        .from('classes_students')
        .select('id, enrolled_at')
        .eq('class_id', params.oldClassId)
        .eq('student_id', params.studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!oldEnrollment) throw new Error('Old class enrollment not found');
      
      // Ensure unenrolled_at is strictly after enrolled_at to satisfy constraint
      let unenrolledAt = new Date(params.changeoverDate);
      const enrolledAt = new Date(oldEnrollment.enrolled_at);
      if (unenrolledAt <= enrolledAt) {
        // Add 1 second to ensure it's strictly after
        unenrolledAt = new Date(enrolledAt.getTime() + 1000);
      }
      
      // Unenroll from old class
      const { error: unenrollError } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: unenrolledAt.toISOString(),
          unenrolled_by: params.staffId 
        })
        .eq('id', oldEnrollment.id);
      
      if (unenrollError) throw unenrollError;
      
      // Enroll in new class
      const payload: TablesInsert<'classes_students'> = {
        id: crypto.randomUUID(),
        class_id: params.newClassId,
        student_id: params.studentId,
        enrolled_at: params.changeoverDate.toISOString(),
        enrolled_by: params.staffId,
      };
      
      const { error: enrollError } = await supabase
        .from('classes_students')
        .insert(payload);
      
      if (enrollError) throw enrollError;
    } catch (error) {
      console.error('Error changing class:', error);
      throw error;
    }
  },

  /**
   * Unenroll a student from a class with a reason note
   */
  unenrollStudentWithReason: async (params: {
    classId: string;
    studentId: string;
    unenrolledAt: Date;
    reason: JSONContent;
    staffId: string;
  }): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get the enrollment record with enrolled_at
      const { data: enrollment, error: fetchError } = await supabase
        .from('classes_students')
        .select('id, enrolled_at')
        .eq('class_id', params.classId)
        .eq('student_id', params.studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!enrollment) throw new Error('Enrollment not found');
      
      // Ensure unenrolled_at is strictly after enrolled_at to satisfy constraint
      let unenrolledAt = new Date(params.unenrolledAt);
      const enrolledAt = new Date(enrollment.enrolled_at);
      if (unenrolledAt <= enrolledAt) {
        // Add 1 second to ensure it's strictly after
        unenrolledAt = new Date(enrolledAt.getTime() + 1000);
      }
      
      // Unenroll the student
      const { error: unenrollError } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: unenrolledAt.toISOString(),
          unenrolled_by: params.staffId 
        })
        .eq('id', enrollment.id);
      
      if (unenrollError) throw unenrollError;
      
      // Create note with the reason (TipTap JSON)
      if (!isTiptapContentEmpty(params.reason)) {
        const notePayload = {
          target_type: 'classes_students',
          target_id: enrollment.id,
          note: params.reason,
          created_by: params.staffId,
        };
        
        const { error: noteError } = await supabase
          .from('notes')
          .insert(notePayload);
        
        if (noteError) throw noteError;
      }
    } catch (error) {
      console.error('Error unenrolling student with reason:', error);
      throw error;
    }
  },
  
  /**
   * Assign a staff member to a class
   */
  assignStaff: async (
    classId: string, 
    staffId: string, 
    currentStaffId?: string
  ): Promise<Tables<'classes_staff'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get current staff ID if not provided
      let assignedBy = currentStaffId;
      if (!assignedBy) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id')
            .eq('user_id', userData.user.id)
            .single();
          if (staffData) {
            assignedBy = staffData.id;
          }
        }
      }
      
      // Check for existing open assignment (unassigned_at IS NULL)
      const { data: existing, error: existingError } = await supabase
        .from('classes_staff')
        .select('id')
        .eq('class_id', classId)
        .eq('staff_id', staffId)
        .is('unassigned_at', null)
        .limit(1);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return (existing![0] as Tables<'classes_staff'>);

      const payload: TablesInsert<'classes_staff'> = {
        id: crypto.randomUUID(),
        class_id: classId,
        staff_id: staffId,
        assigned_at: new Date().toISOString(),
        assigned_by: assignedBy || null,
      };
      const { data, error } = await supabase
        .from('classes_staff')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Tables<'classes_staff'>;
    } catch (error) {
      console.error('Error assigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Remove a staff member from a class
   */
  unassignStaff: async (
    classId: string, 
    staffId: string, 
    currentStaffId?: string
  ): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get current staff ID if not provided
      let unassignedBy = currentStaffId;
      if (!unassignedBy) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id')
            .eq('user_id', userData.user.id)
            .single();
          if (staffData) {
            unassignedBy = staffData.id;
          }
        }
      }
      
      const { error } = await supabase
        .from('classes_staff')
        .update({ 
          unassigned_at: new Date().toISOString(),
          unassigned_by: unassignedBy || null
        })
        .eq('class_id', classId)
        .eq('staff_id', staffId)
        .is('unassigned_at', null);
      if (error) throw error;
    } catch (error) {
      console.error('Error unassigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Get classes by day of week
   */
  getClassesByDay: async (dayOfWeek: number): Promise<Tables<'classes'>[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('day_of_week', dayOfWeek);
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
  
  /**
   * Get classes by status
   */
  getClassesByStatus: async (status: string): Promise<Tables<'classes'>[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('status', status);
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },

  /**
   * Get count of active classes (ACTIVE status with at least one current enrollment).
   * Excludes empty ACTIVE classes.
   */
  getActiveClassesCount: async (): Promise<number> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const nowIso = new Date().toISOString();
    const { count, error } = await supabase
      .from('classes')
      .select('id, classes_students!inner(id)', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${nowIso}`, {
        foreignTable: 'classes_students',
      });
    
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Get count of current class enrollments in classes that have not finished.
   * Excludes past unenrolments, inactive/archived classes, and classes whose
   * session_end_date is before today.
   */
  getCurrentEnrollmentsCount: async (): Promise<number> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const now = new Date();
    const nowIso = now.toISOString();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    const { count, error } = await supabase
      .from('classes_students')
      .select('id, classes!inner(id)', { count: 'exact', head: true })
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${nowIso}`)
      .eq('classes.status', 'ACTIVE')
      .or(`session_end_date.is.null,session_end_date.gte.${today}`, {
        foreignTable: 'classes',
      });

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Fetch classes for a specific subject
   * Returns classes with expanded subject, staff, and students data
   */
  fetchClassesForSubject: async (subjectId: string): Promise<ClassWithExpandedSubject[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
      p_search: undefined,
      p_statuses: ['ACTIVE'],
      p_subject_ids: [subjectId],
      p_include_relationships: true,
      p_exclude_student_search: false,
      p_exclude_staff_search: false,
      p_limit: 10000,
      p_offset: 0,
      p_order_by: 'day_of_week',
      p_ascending: true,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) return [];
    
    interface RPCClass {
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      status: string;
      room: string | null;
      subject_id: string | null;
      level: string | null;
      short_name: string | null;
      long_name: string | null;
      cohort_label: string | null;
      session_start_date: string;
      session_end_date: string;
      schedule_timezone: string;
      schedule_summary_short: string | null;
      schedule_summary_long: string | null;
      schedule_weekdays: number[];
      schedule_rows: Json;
      next_session_start_at: string | null;
      billing_type: Tables<'classes'>['billing_type'];
      billing_type_effective_from: string;
    }
    
    interface RPCSubject {
      id: string;
      name: string;
      curriculum: string | null;
      year_level: number | null;
    }
    
    interface RPCStaff {
      id: string;
      first_name: string;
      last_name: string;
      role: string;
      status: string;
    }
    
    interface RPCStudent {
      id: string;
      first_name: string;
      last_name: string;
      status: string;
    }
    
    const rpcData = rpcResult as unknown as { 
      classes: RPCClass[]; 
      classSubjects: Record<string, RPCSubject>; 
      classStudents: Record<string, RPCStudent[]>; 
      classStaff: Record<string, RPCStaff[]>; 
      total: number 
    };
    
    const rpcClasses = rpcData.classes || [];
    
    // Transform RPC response to match ClassWithExpandedSubject format
    return rpcClasses.map(c => ({
      id: c.id,
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time,
      status: c.status as 'ACTIVE' | 'INACTIVE',
      room: c.room,
      level: c.level,
      subject_id: c.subject_id,
      short_name: c.short_name ?? null,
      long_name: c.long_name ?? null,
      created_at: null,
      updated_at: null,
      created_by: null,
      cohort_label: c.cohort_label,
      session_start_date: c.session_start_date,
      session_end_date: c.session_end_date,
      schedule_timezone: c.schedule_timezone,
      schedule_summary_short: c.schedule_summary_short,
      schedule_summary_long: c.schedule_summary_long,
      schedule_weekdays: c.schedule_weekdays,
      schedule_rows: c.schedule_rows,
      next_session_start_at: c.next_session_start_at,
      billing_type: c.billing_type,
      billing_type_effective_from: c.billing_type_effective_from,
      subject: rpcData.classSubjects?.[c.id] as ClassWithExpandedSubject['subject'] | undefined,
      staff: (rpcData.classStaff?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role as 'ADMINSTAFF' | 'TUTOR',
        status: s.status as 'ACTIVE' | 'INACTIVE',
        email: null,
        phone_number: null,
        created_at: null,
        updated_at: null,
      })),
      students: (rpcData.classStudents?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status as 'ACTIVE' | 'CURRENT' | 'TRIAL' | 'INACTIVE',
        curriculum: null,
        year_level: null,
        school: null,
        email: null,
        phone: null,
        phone_number: null,
        created_at: null,
        updated_at: null,
      }))
    })) as unknown as ClassWithExpandedSubject[];
  },
}; 
