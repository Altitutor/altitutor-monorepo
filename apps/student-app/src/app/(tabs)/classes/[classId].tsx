import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Card,
  EmptyBlock,
  ErrorBlock,
  formatDateTime,
  Label,
  LoadingBlock,
  SectionTitle,
  StudentScreen,
  TappableRow,
  Value,
} from '@/components/student-ui';
import { useClassDetail, useClassSessions } from '@/hooks/use-student-data';

export default function ClassDetailScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const details = useClassDetail(classId);
  const sessions = useClassSessions(classId);

  return (
    <StudentScreen title={details.data?.subject_name ?? 'Class details'} subtitle="Schedule and recent sessions">
      {details.isPending ? <LoadingBlock /> : null}
      {details.isError ? <ErrorBlock message={details.error.message} /> : null}
      {details.data ? (
        <Card>
          <Label>Weekly schedule</Label>
          <Value>{details.data.start_time ?? '--:--'} - {details.data.end_time ?? '--:--'}</Value>
          <Label>Room</Label>
          <Value>{details.data.room ?? 'To be confirmed'}</Value>
        </Card>
      ) : null}
      <SectionTitle>Sessions</SectionTitle>
      {sessions.isPending ? <LoadingBlock label="Loading sessions..." /> : null}
      {sessions.isError ? <ErrorBlock message={sessions.error.message} /> : null}
      {sessions.data?.length === 0 ? <EmptyBlock>No sessions found.</EmptyBlock> : null}
      {sessions.data?.map((session) => (
        <Card key={session.session_id ?? session.start_at}>
          <TappableRow
            title={formatDateTime(session.start_at)}
            detail={session.session_type ?? 'Session'}
            onPress={session.session_id ? () => router.push({ pathname: '/session/[sessionId]', params: { sessionId: session.session_id! } }) : undefined}
          />
        </Card>
      ))}
    </StudentScreen>
  );
}
