import type { Database, Json } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getAdminMeetingActivityWindow } from '../lib/adminMeetingActivityWindow';
import type {
  ActivityEntityType,
  ActivityEntityReference,
  ActivityEvent,
  ActivityEventsParams,
  ActivityEventsResponse,
  SessionActivityResponse,
} from '../types';

type DomainFeedRow = Database['public']['Views']['vadmin_domain_event_feed']['Row'];

function firstId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveLinkedEntity(params: ActivityEventsParams): {
  type?: ActivityEntityType;
  id?: string;
} {
  if (params.entityType && params.entityId) {
    return { type: params.entityType, id: params.entityId };
  }

  const candidates: Array<[ActivityEntityType, string | string[] | undefined]> = [
    ['student', params.studentId],
    ['staff', params.staffId],
    ['class', params.classId],
    ['session', params.sessionId],
    ['parent', params.parentId],
    ['issue', params.issueId],
  ];
  const match = candidates.find(([, value]) => firstId(value));
  return match ? { type: match[0], id: firstId(match[1]) } : {};
}

function parseEntityReferences(value: Json | null): ActivityEntityReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const entityType = item.entity_type;
    const entityId = item.entity_id;
    const role = item.role;
    const displayName = item.display_name;
    if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof role !== 'string') {
      return [];
    }
    return [{
      entityType: entityType as ActivityEntityType,
      entityId,
      role,
      displayName: typeof displayName === 'string' ? displayName : undefined,
    }];
  });
}

function toActivityEvent(row: DomainFeedRow): ActivityEvent | null {
  if (!row.id || !row.event_name || !row.subject_type || !row.subject_id) return null;
  const recordedAt = row.recorded_at || new Date(0).toISOString();
  const effectiveAt = row.effective_at || recordedAt;
  const payload = (row.payload || {}) as Json;

  return {
    id: row.id,
    event_name: row.event_name,
    event_version: row.event_version || 1,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    payload,
    actor_staff_id: row.actor_staff_id,
    recorded_at: recordedAt,
    effective_at: effectiveAt,
    correlation_id: row.correlation_id,
    idempotency_key: null,
    source: row.source || 'application',
    is_backfilled: row.is_backfilled || false,
    actorName: row.actor_name || undefined,
    entities: parseEntityReferences(row.linked_entities),
  };
}

const emptyRelatedEntities: ActivityEventsResponse['relatedEntities'] = {};

export const activityApi = {
  getActivityEvents: async (params: ActivityEventsParams): Promise<ActivityEventsResponse> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { type, id } = resolveLinkedEntity(params);
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = supabase
      .from('vadmin_domain_event_feed')
      .select('*')
      .order('recorded_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type && id) {
      query = query.eq('linked_entity_type', type).eq('linked_entity_id', id);
    }
    if (params.performedByIds?.length) {
      query = query.in('actor_staff_id', params.performedByIds);
    }
    if (params.performedAtGte) query = query.gte('recorded_at', params.performedAtGte);
    if (params.performedAtLte) query = query.lte('recorded_at', params.performedAtLte);

    const { data, error } = await query;
    if (error) throw error;
    const events = (data || [])
      .map((row) => toActivityEvent(row as DomainFeedRow))
      .filter((event): event is ActivityEvent => event !== null);

    return {
      events,
      relatedEntities: emptyRelatedEntities,
      total: offset + events.length,
      hasMore: events.length === limit,
    };
  },

  getStudentActivity: (studentId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({ entityType: 'student', entityId: studentId, limit, offset }),

  getStaffActivity: (staffId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({ entityType: 'staff', entityId: staffId, limit, offset }),

  getClassActivity: (classId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({ entityType: 'class', entityId: classId, limit, offset }),

  getSessionActivity: async (
    sessionId: string,
    limit = 50,
    offset = 0
  ): Promise<SessionActivityResponse> => {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const [activity, sessionResult] = await Promise.all([
      activityApi.getActivityEvents({ entityType: 'session', entityId: sessionId, limit, offset }),
      supabase.from('sessions').select('type, start_at, end_at').eq('id', sessionId).maybeSingle(),
    ]);
    if (sessionResult.error) throw sessionResult.error;
    const session = sessionResult.data;
    const isAdminMeetingLive = session?.type === 'ADMIN_MEETING'
      ? getAdminMeetingActivityWindow(session.start_at, session.end_at).isLive
      : false;
    return { ...activity, isAdminMeetingLive };
  },

  getParentActivity: (parentId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({ entityType: 'parent', entityId: parentId, limit, offset }),

  getTaskActivity: (taskId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({ entityType: 'task', entityId: taskId, limit, offset }),

  getIssueActivity: (params: {
    issueId: string;
    studentIds?: string[];
    staffIds?: string[];
    classIds?: string[];
    sessionIds?: string[];
    invoiceIds?: string[];
    limit?: number;
    offset?: number;
  }) => activityApi.getActivityEvents({
    entityType: 'issue',
    entityId: params.issueId,
    limit: params.limit,
    offset: params.offset,
  }),

  getAdminShiftActivity: (adminShiftId: string, limit = 50, offset = 0) =>
    activityApi.getActivityEvents({
      entityType: 'admin_shift',
      entityId: adminShiftId,
      limit,
      offset,
    }),
};
