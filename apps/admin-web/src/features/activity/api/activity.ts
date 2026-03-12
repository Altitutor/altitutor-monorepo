import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
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
      issueId,
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
      if (Array.isArray(studentId)) {
        query = query.in('student_id', studentId);
      } else {
        query = query.eq('student_id', studentId);
      }
    }
    if (staffId) {
      if (Array.isArray(staffId)) {
        query = query.or(`staff_id.in.(${staffId.join(',')}),performed_by.in.(${staffId.join(',')})`);
      } else {
        query = query.or(`staff_id.eq.${staffId},performed_by.eq.${staffId}`);
      }
    }
    if (classId) {
      if (Array.isArray(classId)) {
        query = query.in('class_id', classId);
      } else {
        query = query.eq('class_id', classId);
      }
    }
    if (sessionId) {
      if (Array.isArray(sessionId)) {
        query = query.in('session_id', sessionId);
      } else {
        query = query.eq('session_id', sessionId);
      }
    }
    if (parentId) {
      if (Array.isArray(parentId)) {
        query = query.in('parent_id', parentId);
      } else {
        query = query.eq('parent_id', parentId);
      }
    }
    if (issueId) {
      if (Array.isArray(issueId)) {
        query = query.in('issue_id', issueId);
      } else {
        query = query.eq('issue_id', issueId);
      }
    }
    if (params.or) {
      query = query.or(params.or);
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
    const issueIds = new Set<string>();
    const subjectIds = new Set<string>();
    const noteIds = new Set<string>();
    const studentsSubjectsIds = new Set<string>();

    events?.forEach((event) => {
      if (event.performed_by) staffIds.add(event.performed_by);
      if (event.staff_id) staffIds.add(event.staff_id);
      if (event.student_id) studentIds.add(event.student_id);
      if (event.class_id) classIds.add(event.class_id);
      if (event.session_id) sessionIds.add(event.session_id);
      if (event.parent_id) parentIds.add(event.parent_id);
      if (event.task_id) taskIds.add(event.task_id);
      if (event.issue_id) issueIds.add(event.issue_id);
      
      // For notes CREATED events, fetch the note content
      if (event.entity_type === 'notes' && event.event_type === 'CREATED') {
        noteIds.add(event.entity_id);
      }
      
      // For students_subjects CREATED events, we need to fetch the subject_id
      if (event.entity_type === 'students_subjects' && event.event_type === 'CREATED') {
        studentsSubjectsIds.add(event.entity_id);
      }
    });

    // Fetch students_subjects records to get subject_ids for CREATED events
    let studentsSubjectsData: { data: Array<{ id: string; subject_id: string }> | null; error: PostgrestError | null } = { data: [], error: null };
    if (studentsSubjectsIds.size > 0) {
      const { data, error } = await supabase
        .from('students_subjects')
        .select('id, subject_id')
        .in('id', Array.from(studentsSubjectsIds));
      studentsSubjectsData = { data, error };
      if (data) {
        data.forEach((row) => {
          if (row.subject_id) subjectIds.add(row.subject_id);
        });
      }
    }

    // Fetch related entities in parallel
    const [staffData, studentsData, classesData, sessionsData, parentsData, tasksData, issuesData, subjectsData, notesData] = await Promise.all([
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
            .select('id, level, subject_id, short_name, long_name')
            .in('id', Array.from(classIds))
        : Promise.resolve({ data: [], error: null }),
      sessionIds.size > 0
        ? supabase
            .from('sessions')
            .select('id, start_at, type, class_id, subject_id, short_name, long_name')
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
      issueIds.size > 0
        ? supabase
            .from('issues')
            .select('id, name, status')
            .in('id', Array.from(issueIds))
        : Promise.resolve({ data: [], error: null }),
      subjectIds.size > 0
        ? supabase
            .from('subjects')
            .select('id, name, short_name, long_name')
            .in('id', Array.from(subjectIds))
        : Promise.resolve({ data: [], error: null }),
      noteIds.size > 0
        ? supabase
            .from('notes')
            .select('id, note')
            .in('id', Array.from(noteIds))
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
      issues: {},
      subjects: {},
      notes: {},
    };

    if (!staffData.error && staffData.data && Array.isArray(staffData.data)) {
      for (const staff of staffData.data) {
        if (staff && typeof staff === 'object' && 'id' in staff) {
          relatedEntities.staff![staff.id] = staff as Tables<'staff'>;
        }
      }
    }

    studentsData.data?.forEach((student) => {
      relatedEntities.students![student.id] = student as Tables<'students'>;
    });

    classesData.data?.forEach((class_) => {
      const classRow = class_ as Tables<'classes'>;
      relatedEntities.classes![classRow.id] = classRow;
      if (classRow.subject_id) {
        subjectIds.add(classRow.subject_id);
      }
    });

    // Collect class IDs and subject IDs from sessions
    const sessionClassIds = new Set<string>();
    sessionsData.data?.forEach((session) => {
      const sessionRow = session as Tables<'sessions'>;
      relatedEntities.sessions![sessionRow.id] = sessionRow;
      if (sessionRow.subject_id) {
        subjectIds.add(sessionRow.subject_id);
      }
      if (sessionRow.class_id) {
        sessionClassIds.add(sessionRow.class_id);
      }
    });

    // Fetch classes from sessions if they weren't already fetched
    const missingClassIds = Array.from(sessionClassIds).filter(id => !relatedEntities.classes?.[id]);
    if (missingClassIds.length > 0) {
      const { data: additionalClassesData } = await supabase
        .from('classes')
        .select('id, level, subject_id, short_name, long_name')
        .in('id', missingClassIds);
      
      additionalClassesData?.forEach((class_) => {
        const classRow = class_ as Tables<'classes'>;
        relatedEntities.classes![classRow.id] = classRow;
        if (classRow.subject_id) {
          subjectIds.add(classRow.subject_id);
        }
      });
    }

    parentsData.data?.forEach((parent) => {
      relatedEntities.parents![parent.id] = parent as Tables<'parents'>;
    });

    tasksData.data?.forEach((task) => {
      relatedEntities.tasks![task.id] = task as Tables<'tasks'>;
    });

    issuesData.data?.forEach((issue) => {
      relatedEntities.issues![issue.id] = issue as Tables<'issues'>;
    });

    subjectsData.data?.forEach((subject) => {
      relatedEntities.subjects![subject.id] = subject as Tables<'subjects'>;
    });

    // Fetch additional subjects if we discovered new subject IDs from classes
    const missingSubjectIds = Array.from(subjectIds).filter(id => !relatedEntities.subjects?.[id]);
    if (missingSubjectIds.length > 0) {
      const { data: additionalSubjectsData } = await supabase
        .from('subjects')
        .select('id, name, short_name, long_name')
        .in('id', missingSubjectIds);
      
      additionalSubjectsData?.forEach((subject) => {
        relatedEntities.subjects![subject.id] = subject as Tables<'subjects'>;
      });
    }

    notesData.data?.forEach((note) => {
      relatedEntities.notes![note.id] = note as Tables<'notes'>;
    });

    // Create mapping of students_subjects entity_id to subject_id
    const studentsSubjectsToSubjectId: Record<string, string> = {};
    if (studentsSubjectsData.data) {
      studentsSubjectsData.data.forEach((row) => {
        if (row.subject_id) {
          studentsSubjectsToSubjectId[row.id] = row.subject_id;
        }
      });
    }

    return {
      events: events || [],
      relatedEntities,
      studentsSubjectsToSubjectId,
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

  /**
   * Get activity events for an issue, including activities for all linked entities
   */
  getIssueActivity: async (params: { 
    issueId: string; 
    studentIds?: string[]; 
    staffIds?: string[]; 
    classIds?: string[]; 
    sessionIds?: string[]; 
    invoiceIds?: string[]; 
    limit?: number; 
    offset?: number; 
  }) => {
    const { issueId, studentIds, staffIds, classIds, sessionIds, invoiceIds, limit = 50, offset = 0 } = params;

    // Build complex OR filter
    const orParts: string[] = [`issue_id.eq.${issueId}`];
    
    if (studentIds && studentIds.length > 0) {
      orParts.push(`student_id.in.(${studentIds.join(',')})`);
    }
    if (staffIds && staffIds.length > 0) {
      orParts.push(`staff_id.in.(${staffIds.join(',')})`);
    }
    if (classIds && classIds.length > 0) {
      orParts.push(`class_id.in.(${classIds.join(',')})`);
    }
    if (sessionIds && sessionIds.length > 0) {
      orParts.push(`session_id.in.(${sessionIds.join(',')})`);
    }
    
    // For invoices we use entity_type/entity_id since there's no denormalized column yet
    if (invoiceIds && invoiceIds.length > 0) {
      orParts.push(`and(entity_type.eq.invoices,entity_id.in.(${invoiceIds.join(',')}))`);
    }

    return activityApi.getActivityEvents({ 
      or: orParts.join(','),
      limit, 
      offset 
    });
  },

  /**
   * Get activity events for an admin shift
   */
  getAdminShiftActivity: async (adminShiftId: string, limit = 50, offset = 0) => {
    return activityApi.getActivityEvents({ entityType: 'admin_shifts', entityId: adminShiftId, limit, offset });
  },
};

