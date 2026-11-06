import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { Card, EmptyBlock, ErrorBlock, KeyValueRow, LoadingBlock, SectionTitle, TappableRow, TutorScreen, Value } from '@/components/tutor-ui';

import { getClass } from './api';
import { operationsKey } from './queries';
import { SessionRows } from './session-list';
import { readPeople, sessionDate, sessionTime, sessionTitle, sessionTypeLabel } from './session-model';

export function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const query = useQuery({
    queryKey: [...operationsKey, 'class', classId],
    queryFn: () => getClass(classId),
    enabled: Boolean(classId),
  });
  const detail = query.data?.detail;
  const students = readPeople(detail?.students);
  const tutors = readPeople(detail?.staff);
  const upcoming = query.data?.sessions ?? [];
  return (
    <TutorScreen title={detail ? sessionTitle(detail) : 'Class'} largeTitle={false}
      refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {query.isPending ? <LoadingBlock label="Loading class…" /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.isSuccess && !detail ? <EmptyBlock>This class is unavailable.</EmptyBlock> : null}
      {detail ? (
        <>
          <Card>
            <KeyValueRow label="Subject"><Value align="right">{detail.subject_name ?? 'To be confirmed'}</Value></KeyValueRow>
            <KeyValueRow label="Type"><Value align="right">{sessionTypeLabel(detail.session_type)}</Value></KeyValueRow>
            {detail.schedule_summary_long ? (
              <KeyValueRow label="Schedule"><Value align="right">{detail.schedule_summary_long}</Value></KeyValueRow>
            ) : null}
            {detail.cohort_label ? <KeyValueRow label="Cohort"><Value align="right">{detail.cohort_label}</Value></KeyValueRow> : null}
            <KeyValueRow label="Room"><Value align="right">{detail.room ?? 'To be confirmed'}</Value></KeyValueRow>
            {detail.next_session_start_at ? (
              <KeyValueRow label="Next session">
                <Value align="right">{sessionDate(detail.next_session_start_at)} · {sessionTime(detail.next_session_start_at)}</Value>
              </KeyValueRow>
            ) : null}
          </Card>

          <SectionTitle>Staff</SectionTitle>
          {tutors.length ? (
            <Card divided>{tutors.map((person) => <TappableRow key={person.id} title={person.name} />)}</Card>
          ) : <EmptyBlock>No staff assigned.</EmptyBlock>}

          <SectionTitle>Students</SectionTitle>
          {students.length ? (
            <Card divided>{students.map((person) => <TappableRow key={person.id} title={person.name} />)}</Card>
          ) : <EmptyBlock>No students enrolled.</EmptyBlock>}

          <SectionTitle>Upcoming sessions</SectionTitle>
          {upcoming.length ? <SessionRows sessions={upcoming} /> : <EmptyBlock>No upcoming sessions.</EmptyBlock>}
        </>
      ) : null}
    </TutorScreen>
  );
}
