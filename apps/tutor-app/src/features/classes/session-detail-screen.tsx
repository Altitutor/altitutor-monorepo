import { hasSessionStarted } from '@altitutor/shared';
import { formatTutorLogStaffAttendanceLabel } from '@altitutor/shared/pay-tiers';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Card, EmptyBlock, ErrorBlock, KeyValueRow, Label, LoadingBlock, SectionTitle, TappableRow, TutorScreen, Value } from '@/components/tutor-ui';

import { useAuth } from '@/providers/auth-provider';

import { ControlRow, OperationButton } from './operation-controls';
import { useSession } from './queries';
import { SessionLessonPlan } from './session-lesson-plan';
import { mayLogSession, records, sessionDate, sessionIsCancelled, sessionTime, sessionTitle, sessionTypeLabel, type SessionPerson } from './session-model';
import { SessionNotes } from './session-notes';

function Roster({ title, people, attendance, idField, sessionType }: {
  title: string;
  people: SessionPerson[];
  attendance: unknown;
  idField: 'staff_id' | 'student_id' | 'parent_id';
  sessionType: string | null;
}) {
  const actualById = new Map(records(attendance).map((row) => [row[idField], row]));
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {people.length ? (
        <Card divided>
          {people.map((person) => {
            const actual = actualById.get(person.id);
            const role = idField === 'staff_id' ? formatTutorLogStaffAttendanceLabel(
              typeof actual?.type === 'string' ? actual.type : person.type, sessionType,
            ) : null;
            const expected = person.plannedAbsence ? 'Planned absence' : person.swapped ? 'Swapped out' : null;
            const status = actual?.attended === true ? 'Attended' : actual?.attended === false ? 'Did not attend' : null;
            return <TappableRow key={person.id} title={person.name} detail={[role, expected, status].filter(Boolean).join(' · ')} />;
          })}
        </Card>
      ) : <EmptyBlock>No {title.toLowerCase()} planned.</EmptyBlock>}
    </>
  );
}

const planTypes = new Set(['CLASS', 'DRAFTING', 'EXAM_COURSE', 'TRIAL_SESSION']);

export function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const query = useSession(sessionId);
  const { profile } = useAuth();
  const data = query.data;
  const session = data?.session;
  const tutorId = profile?.id ?? null;
  const active = Boolean(tutorId && profile?.status === 'ACTIVE');
  const role = data?.staff.find((person) => person.id === tutorId)?.type;
  const canLog = Boolean(data && active && mayLogSession(data.session, role, data.logState));
  const log = data?.tutorLog;
  const topicRows = records(log?.topics);
  const fileRows = records(log?.files);
  const submitter = [log?.created_by_first_name, log?.created_by_last_name].filter(Boolean).join(' ');

  return (
    <TutorScreen title={session ? sessionTitle(session) : 'Session'} largeTitle={false}
      refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {query.isPending ? <LoadingBlock label="Loading session…" /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.isSuccess && !data ? <EmptyBlock>This session is unavailable.</EmptyBlock> : null}
      {data && session ? (
        <>
          <Card>
            <KeyValueRow label="When">
              <Value align="right">
                {session.start_at ? `${sessionDate(session.start_at)} · ` : ''}{sessionTime(session.start_at, session.end_at)}
              </Value>
            </KeyValueRow>
            <KeyValueRow label="Room"><Value align="right">{session.class_room || 'To be confirmed'}</Value></KeyValueRow>
            <KeyValueRow label="Type"><Value align="right">{sessionTypeLabel(session.session_type)}</Value></KeyValueRow>
            {sessionIsCancelled(session) ? <KeyValueRow label="Status"><Value align="right">Cancelled</Value></KeyValueRow> : null}
            {session.class_id ? (
              <TappableRow title="View class" onPress={() => router.push({
                pathname: '/class/[classId]', params: { classId: session.class_id! },
              })} />
            ) : null}
          </Card>

          {planTypes.has(session.session_type ?? '') && !sessionIsCancelled(session) ? (
            <SessionLessonPlan key={sessionId} sessionId={sessionId} subjectId={session.subject_id}
              editable={active && !hasSessionStarted(session.start_at)} />
          ) : null}

          <Roster title="Staff" people={data.staff} attendance={log?.staff_attendance} idField="staff_id" sessionType={session.session_type} />
          <Roster title="Students" people={data.students} attendance={log?.student_attendance} idField="student_id" sessionType={session.session_type} />
          {data.parents.length ? (
            <Roster title="Parents" people={data.parents} attendance={log?.parent_attendance} idField="parent_id" sessionType={session.session_type} />
          ) : null}

          <SectionTitle>Tutor log</SectionTitle>
          {canLog ? (
            <ControlRow><OperationButton label="Add tutor log" prominent onPress={() => router.push({
              pathname: '/log-session/[sessionId]', params: { sessionId },
            })} /></ControlRow>
          ) : null}
          {data.logState?.deleted_at ? <EmptyBlock>An administrator can restore the deleted log for this session.</EmptyBlock> : null}
          {log && !data.logState?.deleted_at ? (
            <Card divided>
              <TappableRow title={submitter ? `Submitted by ${submitter}` : 'Submitted'}
                detail={log.tutor_log_created_at ? sessionDate(log.tutor_log_created_at) : undefined} />
              {topicRows.map((topic, index) => (
                <TappableRow key={typeof topic.id === 'string' ? topic.id : index}
                  title={typeof topic.topic_name === 'string' ? topic.topic_name : 'Topic'} />
              ))}
              {fileRows.map((file, index) => {
                const fileId = typeof file.topics_files_id === 'string' ? file.topics_files_id : undefined;
                return (
                  <TappableRow key={fileId ?? index} title={typeof file.filename === 'string' ? file.filename : 'Resource'}
                    onPress={fileId ? () => router.push({ pathname: '/resource-file/[fileId]', params: { fileId } }) : undefined} />
                );
              })}
            </Card>
          ) : null}
          {!data.logState ? (
            <Label>{hasSessionStarted(session.start_at) ? 'This session has no submitted tutor log.' : 'Logging opens when the session starts.'}</Label>
          ) : null}

          <SessionNotes key={sessionId} sessionId={sessionId} tutorId={tutorId} editable={Boolean(tutorId)} />
        </>
      ) : null}
    </TutorScreen>
  );
}
