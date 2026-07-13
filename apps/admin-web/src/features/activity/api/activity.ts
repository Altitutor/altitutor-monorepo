import type { Database, Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { ActivityEventsParams, ActivityEventsResponse, SessionActivityResponse } from '../types';
import { getActivityDisplaySnapshot } from '../lib/activityDisplay';
import { getAdminMeetingActivityWindow } from '../lib/adminMeetingActivityWindow';

const ADMIN_MEETING_WORK_ENTITY_TYPES = ['tasks', 'issues', 'projects'] as const;

function mergeRelatedEntityMaps<T extends { id: string }>(
  ...maps: Array<Record<string, T> | undefined>
): Record<string, T> {
  const merged: Record<string, T> = {};
  for (const map of maps) {
    if (!map) continue;
    Object.assign(merged, map);
  }
  return merged;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asUuid(value: unknown): string | undefined {
  return typeof value === 'string' && value.length === 36 ? value : undefined;
}

/** subject_id / created_by / student_id stored on students_subjects activity metadata */
function getStudentsSubjectsMeta(metadata: unknown): {
  subjectId?: string;
  createdBy?: string;
  studentId?: string;
} {
  const meta = asRecord(metadata);
  if (!meta) return {};
  return {
    subjectId: asUuid(meta.subject_id),
    createdBy: asUuid(meta.created_by),
    studentId: asUuid(meta.student_id) || asUuid(meta.deleted_student_id),
  };
}

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
      entityTypes,
      studentId,
      staffId,
      classId,
      sessionId,
      parentId,
      issueId,
      performedByIds,
      performedAtGte,
      performedAtLte,
      limit = 50,
      offset = 0,
    } = params;

    // Build query (no exact count — feeds use hasMore / Load more instead)
    let query = supabase
      .from('activity_events')
      .select('*')
      .order('performed_at', { ascending: false });

    // Filter by entity type and ID if provided
    if (entityType && entityId) {
      query = query.eq('entity_type', entityType).eq('entity_id', entityId);
    }
    if (entityTypes && entityTypes.length > 0) {
      query = query.in('entity_type', entityTypes);
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
    if (performedByIds && performedByIds.length > 0) {
      query = query.in('performed_by', performedByIds);
    }
    if (performedAtGte) {
      query = query.gte('performed_at', performedAtGte);
    }
    if (performedAtLte) {
      query = query.lte('performed_at', performedAtLte);
    }
    if (params.or) {
      query = query.or(params.or);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: eventsData, error } = await query;

    if (error) throw error;

    let events = eventsData || [];
    const hasMore = events.length === limit;

    // Service-role / student-JWT writes often leave performed_by null.
    // Backfill from entity attribution columns when available.
    const tutorLogSessionIds = new Set<string>();
    const noteIdsNeedingCreator = new Set<string>();
    const sessionsStudentsIds = new Set<string>();
    const classesStudentsIds = new Set<string>();
    const classesStaffIds = new Set<string>();
    const studentsSubjectsCreatorIds = new Set<string>();
    const studentCreatorIds = new Set<string>();

    events.forEach((event) => {
      if (event.performed_by) return;

      if (
        event.session_id &&
        typeof event.entity_type === 'string' &&
        event.entity_type.startsWith('tutor_logs')
      ) {
        tutorLogSessionIds.add(event.session_id);
      }
      if (event.entity_type === 'notes') {
        noteIdsNeedingCreator.add(event.entity_id);
      }
      if (event.entity_type === 'sessions_students') {
        sessionsStudentsIds.add(event.entity_id);
      }
      if (event.entity_type === 'classes_students') {
        classesStudentsIds.add(event.entity_id);
      }
      if (event.entity_type === 'classes_staff') {
        classesStaffIds.add(event.entity_id);
      }
      if (event.entity_type === 'students_subjects') {
        // Live created_by for still-existing rows; metadata covers deleted rows.
        studentsSubjectsCreatorIds.add(event.entity_id);
      }
      if (event.entity_type === 'students' && event.event_type === 'CREATED') {
        studentCreatorIds.add(event.entity_id);
      }
    });

    const tutorLogCreatedByBySession: Record<string, string> = {};
    if (tutorLogSessionIds.size > 0) {
      const { data: tutorLogs } = await supabase
        .from('tutor_logs')
        .select('session_id, created_by')
        .in('session_id', Array.from(tutorLogSessionIds));

      tutorLogs?.forEach((log) => {
        if (log.session_id && log.created_by) {
          tutorLogCreatedByBySession[log.session_id] = log.created_by;
        }
      });
    }

    const noteCreatedByById: Record<string, string> = {};
    if (noteIdsNeedingCreator.size > 0) {
      const { data: notes } = await supabase
        .from('notes')
        .select('id, created_by')
        .in('id', Array.from(noteIdsNeedingCreator));

      notes?.forEach((note) => {
        if (note.id && note.created_by) {
          noteCreatedByById[note.id] = note.created_by;
        }
      });
    }

    const sessionsStudentsCreatedByById: Record<string, string> = {};
    if (sessionsStudentsIds.size > 0) {
      const { data: rows } = await supabase
        .from('sessions_students')
        .select('id, created_by')
        .in('id', Array.from(sessionsStudentsIds));

      rows?.forEach((row) => {
        if (row.id && row.created_by) {
          sessionsStudentsCreatedByById[row.id] = row.created_by;
        }
      });
    }

    const classesStudentsAttributedById: Record<string, string> = {};
    if (classesStudentsIds.size > 0) {
      const { data: rows } = await supabase
        .from('classes_students')
        .select('id, enrolled_by, created_by, unenrolled_by')
        .in('id', Array.from(classesStudentsIds));

      rows?.forEach((row) => {
        if (!row.id) return;
        // Prefer enroll attribution for the enrollment row itself; unenrolled_by is only
        // meaningful for later unenroll updates (handled via changed_fields in the mapper).
        const attributed = row.enrolled_by || row.created_by || row.unenrolled_by;
        if (attributed) classesStudentsAttributedById[row.id] = attributed;
      });
    }

    const classesStaffAttributedById: Record<string, string> = {};
    if (classesStaffIds.size > 0) {
      const { data: rows } = await supabase
        .from('classes_staff')
        .select('id, assigned_by, created_by, unassigned_by')
        .in('id', Array.from(classesStaffIds));

      rows?.forEach((row) => {
        if (!row.id) return;
        const attributed = row.unassigned_by || row.assigned_by || row.created_by;
        if (attributed) classesStaffAttributedById[row.id] = attributed;
      });
    }

    const studentsSubjectsCreatedByById: Record<string, string> = {};
    if (studentsSubjectsCreatorIds.size > 0) {
      const { data: rows } = await supabase
        .from('students_subjects')
        .select('id, created_by')
        .in('id', Array.from(studentsSubjectsCreatorIds));

      rows?.forEach((row) => {
        if (row.id && row.created_by) {
          studentsSubjectsCreatedByById[row.id] = row.created_by;
        }
      });
    }

    const studentsCreatedByById: Record<string, string> = {};
    if (studentCreatorIds.size > 0) {
      const { data: rows } = await supabase
        .from('students')
        .select('id, created_by')
        .in('id', Array.from(studentCreatorIds));

      rows?.forEach((row) => {
        if (row.id && row.created_by) {
          studentsCreatedByById[row.id] = row.created_by;
        }
      });
    }

    const hasAttributionLookups =
      Object.keys(tutorLogCreatedByBySession).length > 0 ||
      Object.keys(noteCreatedByById).length > 0 ||
      Object.keys(sessionsStudentsCreatedByById).length > 0 ||
      Object.keys(classesStudentsAttributedById).length > 0 ||
      Object.keys(classesStaffAttributedById).length > 0 ||
      Object.keys(studentsSubjectsCreatedByById).length > 0 ||
      Object.keys(studentsCreatedByById).length > 0;

    if (hasAttributionLookups) {
      events = events.map((event) => {
        if (event.performed_by) return event;

        if (
          event.session_id &&
          typeof event.entity_type === 'string' &&
          event.entity_type.startsWith('tutor_logs')
        ) {
          const createdBy = tutorLogCreatedByBySession[event.session_id];
          if (createdBy) return { ...event, performed_by: createdBy };
        }

        if (event.entity_type === 'notes') {
          const createdBy = noteCreatedByById[event.entity_id];
          if (createdBy) return { ...event, performed_by: createdBy };
        }

        if (event.entity_type === 'sessions_students') {
          const createdBy = sessionsStudentsCreatedByById[event.entity_id];
          if (createdBy) return { ...event, performed_by: createdBy };
        }

        if (event.entity_type === 'classes_students') {
          const attributed = classesStudentsAttributedById[event.entity_id];
          if (attributed) return { ...event, performed_by: attributed };
        }

        if (event.entity_type === 'classes_staff') {
          const attributed = classesStaffAttributedById[event.entity_id];
          if (attributed) return { ...event, performed_by: attributed };
        }

        if (event.entity_type === 'students_subjects') {
          const createdBy = studentsSubjectsCreatedByById[event.entity_id];
          if (createdBy) return { ...event, performed_by: createdBy };
        }

        if (event.entity_type === 'students' && event.event_type === 'CREATED') {
          const createdBy = studentsCreatedByById[event.entity_id];
          if (createdBy) return { ...event, performed_by: createdBy };
        }

        return event;
      });
    }

    // Metadata created_by survives after the students_subjects row is deleted.
    events = events.map((event) => {
      if (event.performed_by || event.entity_type !== 'students_subjects') return event;
      const createdBy = getStudentsSubjectsMeta(event.metadata).createdBy;
      if (!createdBy) return event;
      return { ...event, performed_by: createdBy };
    });

    // Session adds created during class enrollment often inherit created_by=enrolled_by,
    // but cron/precreate rows leave both null. If a class enrollment for the same student
    // appears in this page within a short window, reuse that staff performer.
    const ENROLL_ATTRIBUTION_WINDOW_MS = 2 * 60 * 1000;
    const classEnrollPerformers = events
      .filter(
        (event) =>
          event.entity_type === 'classes_students' &&
          event.event_type === 'CREATED' &&
          event.performed_by &&
          event.student_id
      )
      .map((event) => ({
        studentId: event.student_id as string,
        performedBy: event.performed_by as string,
        performedAtMs: new Date(event.performed_at).getTime(),
      }));

    if (classEnrollPerformers.length > 0) {
      events = events.map((event) => {
        if (event.performed_by) return event;
        if (
          (event.entity_type !== 'sessions_students' &&
            event.entity_type !== 'students_subjects') ||
          event.event_type !== 'CREATED'
        ) {
          return event;
        }
        if (!event.student_id) return event;

        const eventAt = new Date(event.performed_at).getTime();
        const sibling = classEnrollPerformers.find(
          (enroll) =>
            enroll.studentId === event.student_id &&
            Math.abs(enroll.performedAtMs - eventAt) <= ENROLL_ATTRIBUTION_WINDOW_MS
        );
        if (!sibling) return event;
        return { ...event, performed_by: sibling.performedBy };
      });
    }

    // Restore student_id on students_subjects DELETE events from metadata when the FK was nulled.
    events = events.map((event) => {
      if (event.entity_type !== 'students_subjects' || event.student_id) return event;
      const studentId = getStudentsSubjectsMeta(event.metadata).studentId;
      if (!studentId) return event;
      return { ...event, student_id: studentId };
    });

    // Collect unique IDs for related entities
    const staffIds = new Set<string>();
    const studentIds = new Set<string>();
    const classIds = new Set<string>();
    const sessionIds = new Set<string>();
    const parentIds = new Set<string>();
    const taskIds = new Set<string>();
    const issueIds = new Set<string>();
    const projectIds = new Set<string>();
    const subjectIds = new Set<string>();
    const noteIds = new Set<string>();
    const studentsSubjectsIds = new Set<string>();
    const tutorLogTopicRowIds = new Set<string>();

    events.forEach((event) => {
      const display = getActivityDisplaySnapshot(event);
      const needsLiveNameEnrichment = !display || event.event_type === 'UPDATED';

      // Note bodies are never snapshotted — always fetch for CREATED notes.
      if (event.entity_type === 'notes' && event.event_type === 'CREATED') {
        noteIds.add(event.entity_id);
      }

      if (event.entity_type === 'tutor_logs_topics' && !display?.topic_name) {
        tutorLogTopicRowIds.add(event.entity_id);
      }

      if (event.entity_type === 'students_subjects') {
        studentsSubjectsIds.add(event.entity_id);
        const metaSubjectId = getStudentsSubjectsMeta(event.metadata).subjectId;
        if (metaSubjectId && !display?.subject_name) {
          subjectIds.add(metaSubjectId);
        }
      }

      if (!needsLiveNameEnrichment) {
        return;
      }

      if (event.performed_by) staffIds.add(event.performed_by);
      if (event.staff_id) staffIds.add(event.staff_id);
      if (event.student_id) studentIds.add(event.student_id);
      if (event.class_id) classIds.add(event.class_id);
      if (event.session_id) sessionIds.add(event.session_id);
      if (event.parent_id) parentIds.add(event.parent_id);
      if (event.task_id) taskIds.add(event.task_id);
      if (event.issue_id) issueIds.add(event.issue_id);
      if (event.project_id) projectIds.add(event.project_id);
      if (event.entity_type === 'tasks') taskIds.add(event.entity_id);
      if (event.entity_type === 'issues') issueIds.add(event.entity_id);
      if (event.entity_type === 'projects') projectIds.add(event.entity_id);

      // Resolve assignee / lead names from UPDATE payloads
      if (event.changed_fields && typeof event.changed_fields === 'object' && !Array.isArray(event.changed_fields)) {
        const fields = event.changed_fields as Record<string, { old?: unknown; new?: unknown }>;
        for (const key of [
          'assigned_to',
          'project_lead_id',
          'created_by',
          'enrolled_by',
          'unenrolled_by',
          'assigned_by',
          'unassigned_by',
          'credited_by',
          'discontinued_by',
          'planned_absence_logged_by',
          'deleted_by',
          'updated_by',
        ] as const) {
          const change = fields[key];
          if (!change || typeof change !== 'object') continue;
          if (typeof change.old === 'string' && change.old.length === 36) staffIds.add(change.old);
          if (typeof change.new === 'string' && change.new.length === 36) staffIds.add(change.new);
        }
      }

      // For students_subjects events without a subject snapshot, resolve subject_id from live rows / metadata
      if (event.entity_type === 'students_subjects') {
        const metaSubjectId = getStudentsSubjectsMeta(event.metadata).subjectId;
        if (metaSubjectId) subjectIds.add(metaSubjectId);
        const metaStudentId = getStudentsSubjectsMeta(event.metadata).studentId;
        if (metaStudentId) studentIds.add(metaStudentId);
      }
    });

    // Fetch students_subjects records to get subject_ids (CREATED / still-existing rows)
    let studentsSubjectsData: { data: Array<{ id: string; subject_id: string; created_by: string | null }> | null; error: PostgrestError | null } = { data: [], error: null };
    if (studentsSubjectsIds.size > 0) {
      const { data, error } = await supabase
        .from('students_subjects')
        .select('id, subject_id, created_by')
        .in('id', Array.from(studentsSubjectsIds));
      studentsSubjectsData = { data, error };
      if (data) {
        data.forEach((row) => {
          if (row.subject_id) subjectIds.add(row.subject_id);
        });
      }
    }

    // Fetch related entities in parallel
    const [staffData, studentsData, classesData, sessionsData, parentsData, tasksData, issuesData, projectsData, subjectsData, notesData, tutorLogTopicsData] = await Promise.all([
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
      projectIds.size > 0
        ? supabase
            .from('projects')
            .select('id, name, status')
            .in('id', Array.from(projectIds))
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
      tutorLogTopicRowIds.size > 0
        ? supabase
            .from('tutor_logs_topics')
            .select('id, topic_id, topics(id, name)')
            .in('id', Array.from(tutorLogTopicRowIds))
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
      projects: {},
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

    projectsData.data?.forEach((project) => {
      relatedEntities.projects![project.id] = project as Tables<'projects'>;
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

    // Create mapping of students_subjects entity_id to subject_id (live row + metadata)
    const studentsSubjectsToSubjectId: Record<string, string> = {};
    events.forEach((event) => {
      if (event.entity_type !== 'students_subjects') return;
      const metaSubjectId = getStudentsSubjectsMeta(event.metadata).subjectId;
      if (metaSubjectId) {
        studentsSubjectsToSubjectId[event.entity_id] = metaSubjectId;
      }
    });
    if (studentsSubjectsData.data) {
      studentsSubjectsData.data.forEach((row) => {
        if (row.subject_id) {
          studentsSubjectsToSubjectId[row.id] = row.subject_id;
        }
      });
    }

    // Historical CREATED/DELETED rows without metadata: infer subject from a nearby class enrollment.
    const missingSubjectEntityIds = events
      .filter(
        (event) =>
          event.entity_type === 'students_subjects' &&
          !studentsSubjectsToSubjectId[event.entity_id] &&
          event.student_id
      )
      .map((event) => event.entity_id);

    if (missingSubjectEntityIds.length > 0) {
      const ENROLL_SUBJECT_WINDOW_MS = 2 * 60 * 1000;
      const enrollClassByStudent = new Map<string, { classId: string; performedAtMs: number }[]>();
      events.forEach((event) => {
        if (
          event.entity_type !== 'classes_students' ||
          event.event_type !== 'CREATED' ||
          !event.student_id ||
          !event.class_id
        ) {
          return;
        }
        const list = enrollClassByStudent.get(event.student_id) ?? [];
        list.push({
          classId: event.class_id,
          performedAtMs: new Date(event.performed_at).getTime(),
        });
        enrollClassByStudent.set(event.student_id, list);
      });

      const classIdsForSubjects = new Set<string>();
      const inferredClassByEntityId: Record<string, string> = {};
      events.forEach((event) => {
        if (event.entity_type !== 'students_subjects') return;
        if (studentsSubjectsToSubjectId[event.entity_id] || !event.student_id) return;
        const candidates = enrollClassByStudent.get(event.student_id) ?? [];
        const eventAt = new Date(event.performed_at).getTime();
        const match = candidates.find(
          (enroll) => Math.abs(enroll.performedAtMs - eventAt) <= ENROLL_SUBJECT_WINDOW_MS
        );
        if (!match) return;
        inferredClassByEntityId[event.entity_id] = match.classId;
        classIdsForSubjects.add(match.classId);
      });

      if (classIdsForSubjects.size > 0) {
        const { data: classSubjects } = await supabase
          .from('classes')
          .select('id, subject_id')
          .in('id', Array.from(classIdsForSubjects));

        const subjectByClassId: Record<string, string> = {};
        classSubjects?.forEach((row) => {
          if (row.subject_id) {
            subjectByClassId[row.id] = row.subject_id;
            subjectIds.add(row.subject_id);
          }
        });

        Object.entries(inferredClassByEntityId).forEach(([entityId, classId]) => {
          const subjectId = subjectByClassId[classId];
          if (subjectId) studentsSubjectsToSubjectId[entityId] = subjectId;
        });

        // Fetch any newly discovered subjects not already loaded
        const missingSubjectIds = Array.from(subjectIds).filter((id) => !relatedEntities.subjects?.[id]);
        if (missingSubjectIds.length > 0) {
          const { data: inferredSubjects } = await supabase
            .from('subjects')
            .select('id, name, short_name, long_name')
            .in('id', missingSubjectIds);
          inferredSubjects?.forEach((subject) => {
            relatedEntities.subjects![subject.id] = subject as Tables<'subjects'>;
          });
        }
      }
    }

    const tutorLogTopicNamesByEntityId: Record<string, string> = {};
    type TutorLogTopicRow = {
      id: string;
      topic_id: string;
      topics: { id: string; name: string } | { id: string; name: string }[] | null;
    };
    if (tutorLogTopicsData.data) {
      (tutorLogTopicsData.data as TutorLogTopicRow[]).forEach((row) => {
        const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
        if (topic?.name) {
          tutorLogTopicNamesByEntityId[row.id] = topic.name;
        }
      });
    }

    return {
      events,
      relatedEntities,
      studentsSubjectsToSubjectId,
      tutorLogTopicNamesByEntityId,
      total: offset + events.length,
      hasMore,
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
   * Get activity events for a session.
   * Admin meetings also include task/issue/project work done during the meeting window
   * by attendees (sessions_staff), for a live + retrospective meeting transcript.
   */
  getSessionActivity: async (sessionId: string, limit = 50, offset = 0): Promise<SessionActivityResponse> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, type, start_at, end_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;

    if (!session || session.type !== 'ADMIN_MEETING') {
      return activityApi.getActivityEvents({ sessionId, limit, offset });
    }

    const window = getAdminMeetingActivityWindow(session.start_at, session.end_at);

    const { data: staffRows, error: staffError } = await supabase
      .from('sessions_staff')
      .select('staff_id')
      .eq('session_id', sessionId);

    if (staffError) throw staffError;

    const attendeeIds = Array.from(
      new Set(
        (staffRows ?? [])
          .map((row) => row.staff_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    // Fetch enough from each source to paginate after merge (meeting feeds are small).
    const fetchLimit = Math.max(limit + offset, limit);

    const sessionActivityPromise = activityApi.getActivityEvents({
      sessionId,
      limit: fetchLimit,
      offset: 0,
    });

    const emptyWorkActivity: ActivityEventsResponse = {
      events: [],
      relatedEntities: {},
      total: 0,
      hasMore: false,
    };

    const workActivityPromise =
      attendeeIds.length > 0
        ? activityApi.getActivityEvents({
            entityTypes: [...ADMIN_MEETING_WORK_ENTITY_TYPES],
            performedByIds: attendeeIds,
            performedAtGte: window.start,
            performedAtLte: window.end,
            limit: fetchLimit,
            offset: 0,
          })
        : Promise.resolve(emptyWorkActivity);

    const [sessionActivity, workActivity] = await Promise.all([
      sessionActivityPromise,
      workActivityPromise,
    ]);

    const byId = new Map<string, ActivityEventsResponse['events'][number]>();
    for (const event of sessionActivity.events) {
      byId.set(event.id, event);
    }
    for (const event of workActivity.events) {
      byId.set(event.id, event);
    }

    const mergedEvents = Array.from(byId.values()).sort(
      (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );
    const pageEvents = mergedEvents.slice(offset, offset + limit);

    const relatedEntities: ActivityEventsResponse['relatedEntities'] = {
      staff: mergeRelatedEntityMaps(sessionActivity.relatedEntities.staff, workActivity.relatedEntities.staff),
      students: mergeRelatedEntityMaps(sessionActivity.relatedEntities.students, workActivity.relatedEntities.students),
      classes: mergeRelatedEntityMaps(sessionActivity.relatedEntities.classes, workActivity.relatedEntities.classes),
      sessions: mergeRelatedEntityMaps(sessionActivity.relatedEntities.sessions, workActivity.relatedEntities.sessions),
      parents: mergeRelatedEntityMaps(sessionActivity.relatedEntities.parents, workActivity.relatedEntities.parents),
      tasks: mergeRelatedEntityMaps(sessionActivity.relatedEntities.tasks, workActivity.relatedEntities.tasks),
      issues: mergeRelatedEntityMaps(sessionActivity.relatedEntities.issues, workActivity.relatedEntities.issues),
      projects: mergeRelatedEntityMaps(sessionActivity.relatedEntities.projects, workActivity.relatedEntities.projects),
      subjects: mergeRelatedEntityMaps(sessionActivity.relatedEntities.subjects, workActivity.relatedEntities.subjects),
      notes: mergeRelatedEntityMaps(sessionActivity.relatedEntities.notes, workActivity.relatedEntities.notes),
    };

    const studentsSubjectsToSubjectId = {
      ...(sessionActivity.studentsSubjectsToSubjectId ?? {}),
      ...(workActivity.studentsSubjectsToSubjectId ?? {}),
    };
    const tutorLogTopicNamesByEntityId = {
      ...(sessionActivity.tutorLogTopicNamesByEntityId ?? {}),
      ...(workActivity.tutorLogTopicNamesByEntityId ?? {}),
    };

    // Prefer exact merged length when we likely fetched everything; otherwise treat as hasMore.
    const fetchedAll =
      sessionActivity.events.length < fetchLimit && workActivity.events.length < fetchLimit;
    const total = fetchedAll
      ? mergedEvents.length
      : Math.max(mergedEvents.length, sessionActivity.total + workActivity.total);
    const hasMore = offset + limit < mergedEvents.length || (!fetchedAll && pageEvents.length === limit);

    return {
      events: pageEvents,
      relatedEntities,
      studentsSubjectsToSubjectId,
      tutorLogTopicNamesByEntityId,
      total,
      hasMore,
      isAdminMeetingLive: window.isLive,
    };
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

