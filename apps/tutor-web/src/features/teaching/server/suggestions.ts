import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { z } from 'zod';
import { parseSessionStudentList } from '@/features/sessions/utils/parseSessionDetailJson';
import { TeachingError } from './auth';
import { teachingResources } from './queries';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const schema = z.object({ sessionID: uuid, resourceIDs: z.array(uuid).max(500), activeResourceID: uuid.optional() }).strict();

export async function teachingSuggestions(client: SupabaseClient<Database>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new TeachingError(400, 'Choose a lesson for suggestions.');
  const { sessionID, resourceIDs, activeResourceID } = parsed.data;
  const current = await client.from('vtutor_operational_session_detail').select('session_id,start_at,subject_id,students')
    .eq('session_id', sessionID).maybeSingle();
  if (current.error) throw new TeachingError(503, 'Could not load lesson suggestions.', current.error);
  if (!current.data) throw new TeachingError(403, 'This lesson is not accessible.');
  const currentLesson = current.data;
  let anchors = resourceIDs;
  let source: 'current' | 'previous' = 'current';
  if (!anchors.length && currentLesson.subject_id && currentLesson.start_at) {
    const roster = (value: unknown) => parseSessionStudentList(value).map(p => p.id).sort().join(',');
    const earlier = await client.from('vtutor_operational_session_detail').select('session_id,students')
      .eq('subject_id', currentLesson.subject_id).lt('start_at', currentLesson.start_at).order('start_at', { ascending: false }).limit(100);
    if (earlier.error) throw new TeachingError(503, 'Could not load the previous lesson.', earlier.error);
    const sameGroup = (earlier.data ?? []).filter(row => row.session_id && roster(row.students) === roster(currentLesson.students));
    if (sameGroup.length) {
      const logs = await client.from('vtutor_tutor_log').select('session_id,files').in('session_id', sameGroup.flatMap(row => row.session_id ? [row.session_id] : []));
      if (logs.error) throw new TeachingError(503, 'Could not load previous lesson resources.', logs.error);
      for (const lesson of sameGroup) {
        const files = logs.data?.find(log => log.session_id === lesson.session_id)?.files;
        if (!Array.isArray(files)) continue;
        anchors = files.flatMap(file => {
          if (!file || typeof file !== 'object' || Array.isArray(file)) return [];
          const id = uuid.safeParse(file.topics_files_id);
          return id.success ? [id.data] : [];
        });
        if (anchors.length) { source = 'previous'; break; }
      }
    }
  }
  if (!anchors.length) return { resources: [], source };
  const selected = await client.from('vtutor_topics_files').select('id,topic_id,type,index').in('id', anchors)
    .is('deleted_at', null).is('is_solutions_of_id', null);
  if (selected.error) throw new TeachingError(503, 'Could not verify suggested resources.', selected.error);
  const selectedRows = selected.data ?? [];
  const anchor = source === 'previous'
    ? [...selectedRows].sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0]
    : selectedRows.find(row => row.id === activeResourceID) ?? [...anchors].reverse().map(id => selectedRows.find(row => row.id === id)).find(Boolean);
  if (!anchor?.topic_id) return { resources: [], source };
  const excluded = new Set([...resourceIDs, ...anchors]);
  const next = await client.from('vtutor_topics_files').select('id,index').eq('topic_id', anchor.topic_id)
    .eq('type', anchor.type ?? 'PRACTICE_QUESTIONS').gt('index', anchor.index ?? 0)
    .is('deleted_at', null).is('is_solutions_of_id', null).order('index').order('id').limit(508);
  const others = await client.from('vtutor_topics_files').select('id,index').eq('topic_id', anchor.topic_id)
    .is('deleted_at', null).is('is_solutions_of_id', null).order('index').order('id').limit(508);
  if (next.error || others.error) throw new TeachingError(503, 'Could not load suggested resources.', next.error ?? others.error);
  const ids = [...new Set([...(next.data ?? []), ...(others.data ?? [])].flatMap(row => row.id && !excluded.has(row.id) ? [row.id] : []))].slice(0, 8);
  if (!ids.length) return { resources: [], source };
  const page = await teachingResources(client, new URLSearchParams({ resourceIDs: ids.join(',') }));
  return { resources: ids.flatMap(id => page.resources.filter(resource => resource.id === id)), source };
}
