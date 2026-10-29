import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { NextRequest } from 'next/server';
import { parseSessionParentList, parseSessionStaffList, parseSessionStudentList } from '@/features/sessions/utils/parseSessionDetailJson';
import { submitTutorLog } from '@/features/tutor-logs/server/submit-tutor-log';
import { TeachingError } from './auth';
import type { TeachingLogInput } from './validation';

function exactRoster(actual: string[], expected: string[], label: string) {
  const unique = new Set(actual);
  if (unique.size !== actual.length || unique.size !== expected.length || expected.some(id => !unique.has(id))) {
    throw new TeachingError(409, `The ${label} roster changed or attendance is incomplete. Refresh the lesson and confirm everyone.`);
  }
}

/** Native input is restricted to the caller-visible session roster and resource catalog before the shared submission boundary. */
export async function submitTeachingLog(request: Request, client: SupabaseClient<Database>, input: TeachingLogInput) {
  const { data: session, error } = await client.from('vtutor_operational_session_detail')
    .select('session_id,staff,students,parents').eq('session_id', input.sessionId).maybeSingle();
  if (error) throw new TeachingError(503, 'Could not verify the lesson roster.');
  if (!session) throw new TeachingError(403, 'You do not have access to this lesson.');
  const staff = parseSessionStaffList(session.staff).filter(p => p.id);
  exactRoster(input.staffAttendance.map(p => p.staffId), staff.map(p => p.id), 'staff');
  exactRoster(input.studentAttendance.map(p => p.studentId), parseSessionStudentList(session.students).filter(p => p.id).map(p => p.id), 'student');
  exactRoster(input.parentAttendance.map(p => p.parentId), parseSessionParentList(session.parents).map(p => p.id), 'parent');
  if (input.staffAttendance.some(p => p.type !== staff.find(s => s.id === p.staffId)?.type)) {
    throw new TeachingError(409, 'A staff assignment changed. Refresh the lesson before logging.');
  }
  const attending = new Set(input.studentAttendance.filter(p => p.attended).map(p => p.studentId));
  const topicIDs = input.topics.map(t => t.topicId);
  const fileIDs = input.topicFiles.map(f => f.topicsFilesId);
  if (new Set(topicIDs).size !== topicIDs.length || new Set(fileIDs).size !== fileIDs.length) {
    throw new TeachingError(400, 'Choose each topic and file only once.');
  }
  if ([...input.topics, ...input.topicFiles].some(t => new Set(t.studentIds).size !== t.studentIds.length || t.studentIds.some(id => !attending.has(id)))) {
    throw new TeachingError(400, 'Teaching activity can only be assigned to attending students.');
  }
  if (topicIDs.length) {
    const topics = await client.from('vtutor_topics').select('id').in('id', topicIDs);
    if (topics.error) throw new TeachingError(503, 'Could not verify lesson topics.');
    if (topics.data?.length !== topicIDs.length) throw new TeachingError(403, 'A topic is no longer accessible.');
  }
  if (fileIDs.length) {
    const files = await client.from('vtutor_topics_files').select('id,topic_id,is_solutions_of_id').in('id', fileIDs).is('deleted_at', null);
    if (files.error) throw new TeachingError(503, 'Could not verify lesson files.');
    if (files.data?.length !== fileIDs.length) throw new TeachingError(403, 'A resource is no longer accessible.');
    for (const file of input.topicFiles) {
      const row = files.data.find(f => f.id === file.topicsFilesId);
      const topic = input.topics.find(t => t.topicId === file.topicId);
      if (!row || row.topic_id !== file.topicId || row.is_solutions_of_id || !topic || file.studentIds.some(id => !topic.studentIds.includes(id))) {
        throw new TeachingError(409, 'A resource or topic changed. Review the lesson draft before submitting.');
      }
    }
  }
  const response = await submitTutorLog(new NextRequest(request.url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }), client);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
