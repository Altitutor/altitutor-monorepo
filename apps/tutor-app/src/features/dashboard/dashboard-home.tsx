import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, TappableRow, TutorScreen } from '@/components/tutor-ui';
import { getDayUpdates, listCalendarSessions } from '@/features/classes/api';
import { ControlRow, OperationButton } from '@/features/classes/operation-controls';
import { operationsKey, useUnloggedSessions } from '@/features/classes/queries';
import { SessionRows } from '@/features/classes/session-list';
import { adelaideDayRange, sessionDate } from '@/features/classes/session-model';
import { useAuth } from '@/providers/auth-provider';

export function DashboardHome() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date());
  const range = adelaideDayRange(date);
  useFocusEffect(useCallback(() => {
    setDate(new Date());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setDate(new Date());
    });
    return () => subscription.remove();
  }, []));
  const { profile } = useAuth();
  const sessions = useQuery({
    queryKey: [...operationsKey, 'sessions', range],
    queryFn: () => listCalendarSessions(range),
  });
  const updates = useQuery({
    queryKey: [...operationsKey, 'updates', range],
    queryFn: () => getDayUpdates(range),
  });
  const unlogged = useUnloggedSessions();

  function refresh() {
    setDate(new Date());
    void sessions.refetch();
    void updates.refetch();
    if (unlogged.isEnabled) void unlogged.refetch();
  }

  return (
    <TutorScreen
      title="Home"
      subtitle={`Hi, ${profile?.first_name?.trim() || 'Tutor'}. ${sessionDate(date)}`}
      refreshing={sessions.isRefetching || updates.isRefetching || unlogged.isRefetching}
      onRefresh={refresh}>
      <SectionTitle>Today’s sessions</SectionTitle>
      {sessions.isPending ? <LoadingBlock label="Loading today’s sessions…" /> : null}
      {sessions.isError ? <ErrorBlock message={sessions.error.message} /> : null}
      {sessions.data?.length ? <SessionRows sessions={sessions.data} /> : null}
      {sessions.data?.length === 0 ? <EmptyBlock>You have no sessions today.</EmptyBlock> : null}
      <ControlRow>
        <OperationButton label="Open timetable" onPress={() => router.push('/classes')} />
      </ControlRow>

      <SectionTitle>Updates</SectionTitle>
      {updates.isPending ? <LoadingBlock label="Checking today’s updates…" /> : null}
      {updates.isError ? <ErrorBlock message={updates.error.message} /> : null}
      {updates.data?.length ? (
        <Card divided>
          {updates.data.map((update) => (
            <TappableRow key={update.id} title={update.label} detail={update.detail} onPress={() => router.push({
              pathname: '/session/[sessionId]',
              params: { sessionId: update.sessionId },
            })} />
          ))}
        </Card>
      ) : null}
      {updates.data?.length === 0 ? <EmptyBlock>No changes for today.</EmptyBlock> : null}

      {unlogged.isError ? <ErrorBlock message={unlogged.error.message} /> : null}
      {unlogged.data?.length ? (
        <>
          <SectionTitle>Unlogged sessions</SectionTitle>
          <SessionRows sessions={unlogged.data} log />
        </>
      ) : null}
    </TutorScreen>
  );
}
