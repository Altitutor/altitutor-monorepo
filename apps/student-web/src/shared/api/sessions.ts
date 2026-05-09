import type { Database, Json, ResourceFile } from '@altitutor/shared';
import { mapTopicFile } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';
import type { FlattenedSessionDetail } from '@/features/sessions/utils/session-helpers';
import { getSessionTitle } from '@/features/sessions/utils/session-helpers';

type StudentSessionBase = Database['public']['Views']['vstudent_session_base']['Row'];

export interface StudentSessionWithStaff extends Omit<StudentSessionBase, 'staff' | 'students'> {
  staff: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role?: string;
    type?: string;
  }>;
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    year_level?: number;
  }>;
}

type TutorLogTopicJson = {
  id: string;
  topic_id: string;
  topic_name: string;
  topic_index: number;
  parent_id: string | null;
  subject_id: string;
};

type TutorLogFileJson = {
  topics_files_id: string;
  topic_id: string;
};

function parseTutorLogTopics(raw: Json | null): TutorLogTopicJson[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is TutorLogTopicJson =>
      row !== null &&
      typeof row === 'object' &&
      typeof (row as TutorLogTopicJson).topic_id === 'string' &&
      typeof (row as TutorLogTopicJson).topic_name === 'string' &&
      typeof (row as TutorLogTopicJson).topic_index === 'number',
  );
}

function parseTutorLogFiles(raw: Json | null): TutorLogFileJson[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is TutorLogFileJson =>
      row !== null &&
      typeof row === 'object' &&
      typeof (row as TutorLogFileJson).topics_files_id === 'string' &&
      typeof (row as TutorLogFileJson).topic_id === 'string',
  );
}

export type SessionTutorLogTopicSection = {
  topicId: string;
  code: string;
  name: string;
  topicIndex: number;
  subjectShortName: string;
  files: ResourceFile[];
};

export type SessionTutorLogResources = {
  tutorLogId: string;
  topicSections: SessionTutorLogTopicSection[];
};

export type RecentSessionTutorLogDashboard = {
  sessionId: string;
  session: FlattenedSessionDetail;
  sessionTitle: string;
  tutorLogResources: SessionTutorLogResources;
};

export const studentSessionsApi = {
  /**
   * List all sessions for the current student within a date range
   * Uses vstudent_session_base which includes staff as JSON
   */
  list: async (rangeStart: string, rangeEnd: string): Promise<StudentSessionWithStaff[]> => {
    const supabase = getSupabaseClient();

    const utcStart = dateStringToUtcStart(rangeStart);
    const utcEnd = dateStringToUtcEnd(rangeEnd);

    const { data, error } = await supabase
      .from('vstudent_session_base')
      .select('*')
      .gte('start_at', utcStart)
      .lte('start_at', utcEnd)
      .order('start_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((session) => {
      const sessionWithRelations = session as StudentSessionBase & {
        staff?: unknown;
        students?: unknown;
      };
      const staff = Array.isArray(sessionWithRelations.staff)
        ? (sessionWithRelations.staff as StudentSessionWithStaff['staff'])
        : [];
      const students = Array.isArray(sessionWithRelations.students)
        ? (sessionWithRelations.students as StudentSessionWithStaff['students'])
        : [];
      return {
        ...session,
        staff,
        students,
      } as StudentSessionWithStaff;
    });
  },

  /**
   * Get a single session with all details
   * Uses vstudent_session_detail view which includes students and staff
   */
  getSessionWithDetails: async (sessionId: string) => {
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase
        .from('vstudent_session_detail')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting session with details:', error);
      throw error;
    }
  },

  /**
   * Tutor log row for this session (student-scoped via vstudent_tutor_log), with topics and files
   * enriched for the resources UI (codes, subject short names, ResourceFile rows).
   */
  getSessionTutorLogResources: async (
    sessionId: string,
    opts: { sessionSubjectId: string | null; sessionSubjectShortName: string | null },
  ): Promise<SessionTutorLogResources | null> => {
    const supabase = getSupabaseClient();

    const { data: logRow, error: logError } = await supabase
      .from('vstudent_tutor_log')
      .select('tutor_log_id, topics, files')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (logError) throw logError;
    if (!logRow?.tutor_log_id) return null;

    const topicsFromLog = parseTutorLogTopics(logRow.topics);
    const filesFromLog = parseTutorLogFiles(logRow.files);

    const topicIds = [
      ...new Set([
        ...topicsFromLog.map((t) => t.topic_id),
        ...filesFromLog.map((f) => f.topic_id),
      ]),
    ];

    const topicsFilesIds = [...new Set(filesFromLog.map((f) => f.topics_files_id))];

    const [topicsRes, topicFilesRes] = await Promise.all([
      topicIds.length
        ? supabase
            .from('vstudent_topics')
            .select('id, code, name, index, subject_id')
            .in('id', topicIds)
        : Promise.resolve({ data: [] as const, error: null }),
      topicsFilesIds.length
        ? supabase.from('vstudent_topics_files').select('*').in('id', topicsFilesIds)
        : Promise.resolve({ data: [] as const, error: null }),
    ]);

    if (topicsRes.error) throw topicsRes.error;
    if (topicFilesRes.error) throw topicFilesRes.error;

    const topicMeta = new Map<
      string,
      { code: string; name: string; index: number; subject_id: string | null }
    >();
    for (const row of topicsRes.data ?? []) {
      if (!row.id || !row.code) continue;
      topicMeta.set(row.id, {
        code: row.code,
        name: row.name ?? row.code,
        index: row.index ?? 0,
        subject_id: row.subject_id ?? null,
      });
    }

    const subjectIds = [...new Set([...topicMeta.values()].map((t) => t.subject_id).filter(Boolean))] as string[];

    const { data: subjectsData, error: subjectsError } = subjectIds.length
      ? await supabase.from('vstudent_subjects').select('id, short_name').in('id', subjectIds)
      : { data: [] as const, error: null };

    if (subjectsError) throw subjectsError;

    const subjectShortById = new Map<string, string>();
    for (const s of subjectsData ?? []) {
      if (s.id && s.short_name) subjectShortById.set(s.id, s.short_name);
    }

    const filesByTopic = new Map<string, ResourceFile[]>();
    for (const row of topicFilesRes.data ?? []) {
      const file = mapTopicFile(row);
      if (!file?.topicId) continue;
      const list = filesByTopic.get(file.topicId) ?? [];
      list.push(file);
      filesByTopic.set(file.topicId, list);
    }

    for (const list of filesByTopic.values()) {
      list.sort((a, b) => a.index - b.index || a.code.localeCompare(b.code));
    }

    const seen = new Set<string>();
    const orderedTopicIds: string[] = [];

    const logSorted = [...topicsFromLog].sort((a, b) => a.topic_index - b.topic_index || a.topic_name.localeCompare(b.topic_name));
    for (const t of logSorted) {
      if (seen.has(t.topic_id)) continue;
      seen.add(t.topic_id);
      orderedTopicIds.push(t.topic_id);
    }

    const orphanTopicIds = topicIds.filter((id) => !seen.has(id));
    orphanTopicIds.sort((a, b) => {
      const ma = topicMeta.get(a);
      const mb = topicMeta.get(b);
      return (ma?.index ?? 0) - (mb?.index ?? 0) || (ma?.name ?? '').localeCompare(mb?.name ?? '');
    });
    orderedTopicIds.push(...orphanTopicIds);

    const topicSections: SessionTutorLogTopicSection[] = orderedTopicIds.map((topicId) => {
      const meta = topicMeta.get(topicId);
      const fromLog = topicsFromLog.find((t) => t.topic_id === topicId);
      const name = meta?.name ?? fromLog?.topic_name ?? 'Topic';
      const code = meta?.code ?? '—';
      const topicIndex = meta?.index ?? fromLog?.topic_index ?? 0;
      const sid = meta?.subject_id ?? fromLog?.subject_id ?? null;
      const subjectShortName =
        (sid ? subjectShortById.get(sid) : undefined) ??
        (sid && sid === opts.sessionSubjectId ? opts.sessionSubjectShortName : undefined) ??
        '';

      return {
        topicId,
        code,
        name,
        topicIndex,
        subjectShortName,
        files: filesByTopic.get(topicId) ?? [],
      };
    });

    return {
      tutorLogId: logRow.tutor_log_id,
      topicSections,
    };
  },

  /**
   * Latest tutor log for the current student (by log time), with session detail and resource links data.
   */
  getRecentSessionTutorLogForDashboard: async (): Promise<RecentSessionTutorLogDashboard | null> => {
    const supabase = getSupabaseClient();

    const { data: latest, error: latestError } = await supabase
      .from('vstudent_tutor_log')
      .select('session_id')
      .order('tutor_log_created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    const sessionId = latest?.session_id;
    if (!sessionId) return null;

    const { data: detail, error: detailError } = await supabase
      .from('vstudent_session_detail')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (detailError) throw detailError;
    if (!detail) return null;

    const flat = detail as unknown as FlattenedSessionDetail;
    const tutorLogResources = await studentSessionsApi.getSessionTutorLogResources(sessionId, {
      sessionSubjectId: flat.subject_id ?? null,
      sessionSubjectShortName: flat.subject_short_name ?? null,
    });

    if (!tutorLogResources) return null;

    return {
      sessionId,
      session: flat,
      sessionTitle: getSessionTitle(flat),
      tutorLogResources,
    };
  },
};
