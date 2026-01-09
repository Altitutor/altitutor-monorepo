import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityEventsParams, ActivityEventsResponse } from '../types';

/**
 * Activity API client for working with activity events
 */
export const activityApi = {
  /**
   * Get activity events with related entities
   */
  getActivityEvents: async (params: ActivityEventsParams): Promise<ActivityEventsResponse> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const {
      entityType,
      entityId,
      studentId,
      staffId,
      classId,
      sessionId,
      parentId,
      limit = 50,
      offset = 0,
    } = params;

    // Build query
    let query = supabase
      .from('activity_events')
      .select('*', { count: 'exact' })
      .order('performed_at', { ascending: false });

    // Filter by entity type and ID if provided
    if (entityType && entityId) {
      query = query.eq('entity_type', entityType).eq('entity_id', entityId);
    }

    // Filter by denormalized foreign keys
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (staffId) {
      query = query.eq('staff_id', staffId);
    }
    if (classId) {
      query = query.eq('class_id', classId);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: events, count, error } = await query;

    if (error) throw error;

    // Collect unique IDs for related entities
    const staffIds = new Set<string>();
    const studentIds = new Set<string>();
    const classIds = new Set<string>();
    const sessionIds = new Set<string>();
    const parentIds = new Set<string>();
    const taskIds = new Set<string>();

    events?.forEach((event) => {
      if (event.performed_by) staffIds.add(event.performed_by);
      if (event.staff_id) staffIds.add(event.staff_id);
      if (event.student_id) studentIds.add(event.student_id);
      if (event.class_id) classIds.add(event.class_id);
      if (event.session_id) sessionIds.add(event.session_id);
      if (event.parent_id) parentIds.add(event.parent_id);
      if (event.task_id) taskIds.add(event.task_id);
    });

    // Fetch related entities in parallel
    const [staffData, studentsData, classesData, sessionsData, parentsData, tasksData] = await Promise.all([
      staffIds.size > 0
        ? supabase
            .from('staff')
            .select('id, first_name, last_name, email')
            .in('id', Array.from(staffIds))
        : Promise.resolve({ data: [], error: null }),
      studentIds.size > 0
        ? supabase
            .from('students')
            .select('id, first_name, last_name')
            .in('id', Array.from(studentIds))
        : Promise.resolve({ data: [], error: null }),
      classIds.size > 0
        ? supabase
            .from('classes')
            .select('id, level, subject_id')
            .in('id', Array.from(classIds))
        : Promise.resolve({ data: [], error: null }),
      sessionIds.size > 0
        ? supabase
            .from('sessions')
            .select('id, start_at, type')
            .in('id', Array.from(sessionIds))
        : Promise.resolve({ data: [], error: null }),
      parentIds.size > 0
        ? supabase
            .from('parents')
            .select('id, first_name, last_name')
            .in('id', Array.from(parentIds))
        : Promise.resolve({ data: [], error: null }),
      taskIds.size > 0
        ? supabase
            .from('tasks')
            .select('id, title, status')
            .in('id', Array.from(taskIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Build related entities maps
    const relatedEntities: ActivityEventsResponse['relatedEntities'] = {
      staff: {},
      students: {},
      classes: {},
      sessions: {},
      parents: {},
      tasks: {},
    };

    if (!staffData.error && staffData.data && Array.isArray(staffData.data)) {
      for (const staff of staffData.data) {
        if (staff && typeof staff === 'object' && 'id' in staff) {
          relatedEntities.staff![staff.id] = staff as any;
        }
      }
    }

    studentsData.data?.forEach((student) => {
      relatedEntities.students![student.id] = student as any;
    });

    classesData.data?.forEach((class_) => {
      relatedEntities.classes![class_.id] = class_ as any;
    });

    sessionsData.data?.forEach((session) => {
      relatedEntities.sessions![session.id] = session as any;
    });

    parentsData.data?.forEach((parent) => {
      relatedEntities.parents![parent.id] = parent as any;
    });

    tasksData.data?.forEach((task) => {
      relatedEntities.tasks![task.id] = task as any;
    });

    return {
      events: events || [],
      relatedEntities,
      total: count || 0,
    };
  },

  /**
   * Get activity events for a student
   */
  getStudentActivity: async (studentId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ studentId, limit, offset });
  },

  /**
   * Get activity events for a staff member
   */
  getStaffActivity: async (staffId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ staffId, limit, offset });
  },

  /**
   * Get activity events for a class
   */
  getClassActivity: async (classId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ classId, limit, offset });
  },

  /**
   * Get activity events for a session
   */
  getSessionActivity: async (sessionId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ sessionId, limit, offset });
  },

  /**
   * Get activity events for a parent
   */
  getParentActivity: async (parentId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ parentId, limit, offset });
  },

  /**
   * Get activity events for a task
   */
  getTaskActivity: async (taskId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ entityType: 'tasks', entityId: taskId, limit, offset });
  },
};

