import { useRouter } from 'expo-router';

import { useMemo } from 'react';

import {
  Card,
  EmptyBlock,
  ErrorBlock,
  formatDateTime,
  LoadingBlock,
  SectionTitle,
  StudentScreen,
  TappableRow,
} from '@/components/student-ui';
import { useUpcomingSessions } from '@/hooks/use-student-data';

export default function DashboardScreen() {
  const router = useRouter();
  const sessions = useUpcomingSessions();
  const nextByClass = useMemo(() => {
    const found = new Set<string>();
    return (sessions.data ?? []).filter((session) => {
      const key = session.class_id ?? session.subject_id ?? session.session_id ?? '';
      if (!key || found.has(key)) return false;
      found.add(key);
      return true;
    });
  }, [sessions.data]);

  return (
    <StudentScreen
      title="Dashboard"
      subtitle="Welcome back. Here is what is coming up."
      refreshing={sessions.isRefetching}
      onRefresh={() => sessions.refetch()}>
      <SectionTitle>Upcoming sessions</SectionTitle>
      {sessions.isPending ? <LoadingBlock label="Finding sessions..." /> : null}
      {sessions.isError ? <ErrorBlock message={sessions.error.message} /> : null}
      {nextByClass.length === 0 && !sessions.isPending ? <EmptyBlock>No upcoming sessions scheduled.</EmptyBlock> : null}
      {nextByClass.map((session) => (
        <Card key={session.session_id ?? session.start_at}>
          <TappableRow
            title={`${session.subject_year_level ? `Year ${session.subject_year_level} ` : ''}${session.subject_name ?? 'Tutoring session'}`}
            detail={`${formatDateTime(session.start_at)}${session.room ? ` · ${session.room}` : ''}`}
            accent={session.subject_color}
            onPress={session.session_id ? () => router.push({ pathname: '/session/[sessionId]', params: { sessionId: session.session_id! } }) : undefined}
          />
        </Card>
      ))}
    </StudentScreen>
  );
}
