import { pastSessionTypes, type PastSessionHistoryPage } from '@altitutor/shared';
import { type NextRequest } from 'next/server';

import { collectPastSessionPage, readPastSessionRequest } from '@/features/sessions/server/past-session-page';
import { parseSessionStaffList, parseSessionStudentList } from '@/features/sessions/utils/parseSessionDetailJson';
import { matchesPastSessionFilters, matchesPastSessionSearch } from '@/features/sessions/utils/pastSessionsTable';
import { formatPersonDisplayName, formatTutorSessionSubjectLabel } from '@/features/sessions/utils/sessionSubjectLabel';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { createClient } from '@/shared/lib/supabase/server-ssr';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: NextRequest) {
  try {
    const input = readPastSessionRequest(request.nextUrl.searchParams);
    if (!input) return json({ error: 'Check your session filters and try again.' }, 400);

    const client = await createClient(request);
    const { data, error } = await client.auth.getUser();
    if (error && (error.status ?? 0) >= 500) throw error;
    if (!data.user) return json({ error: 'Sign in to see your sessions.' }, 401);
    const profile = await client.from('vtutor_profile').select('id').maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data?.id) return json({ error: 'Tutor access is required.' }, 403);

    if (input.requestedTypes && !input.types.length) return json({ rows: [], next: null });

    const now = new Date().toISOString();
    const page = await collectPastSessionPage(async (cursor, limit) => {
      let query = client.from('vtutor_operational_session_detail')
        .select('session_id,start_at,end_at,session_type,subject_id,subject_color,subject_curriculum,subject_year_level,subject_name,class_level,short_name,staff,students')
        .lte('start_at', now)
        .in('session_type', input.types.length ? input.types : [...pastSessionTypes])
        .order('start_at', { ascending: false }).order('session_id').limit(limit);
      if (input.subjectIds.length) query = query.in('subject_id', input.subjectIds);
      if (input.from) query = query.gte('start_at', input.from);
      if (input.until) query = query.lt('start_at', input.until);
      if (cursor) {
        query = query.or(`start_at.lt.${cursor.startAt},and(start_at.eq.${cursor.startAt},session_id.gt.${cursor.id})`);
      }
      const result = await query;
      if (result.error) throw result.error;
      return (result.data ?? []).flatMap((row) => row.session_id && row.start_at ? [{
        ...row,
        id: row.session_id,
        startAt: row.start_at,
        staff: parseSessionStaffList(row.staff).filter(({ id }) => id),
        students: parseSessionStudentList(row.students).filter(({ id }) => id),
      }] : []);
    }, (row) => matchesPastSessionSearch(row, input.search) && matchesPastSessionFilters(row, {
      staffIds: input.staffIds,
      studentIds: input.studentIds,
    }), input.cursor);

    return json({
      rows: page.rows.map((row) => ({
        id: row.id,
        startAt: row.startAt,
        endAt: row.end_at,
        subject: formatTutorSessionSubjectLabel(row),
        subjectColor: row.subject_color,
        staff: row.staff.map((person) => ({ id: person.id, name: formatPersonDisplayName(person) })),
        students: row.students.map((person) => ({ id: person.id, name: formatPersonDisplayName(person) })),
      })),
      next: page.next,
    } satisfies PastSessionHistoryPage);
  } catch (error) {
    captureApiError(error, '/api/sessions/past');
    return json({ error: 'Past sessions are temporarily unavailable.' }, 503);
  }
}
