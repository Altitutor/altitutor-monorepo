import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Card, EmptyBlock, SectionTitle, TappableRow } from '@/components/tutor-ui';

import type { TutorSession } from './api';
import { adelaideDateKey, sessionDate, sessionIsCancelled, sessionTime, sessionTitle } from './session-model';

export function SessionRows({ sessions, log = false }: { sessions: TutorSession[]; log?: boolean }) {
  const router = useRouter();
  return (
    <Card divided>
      {sessions.map((session) => {
        if (!session.session_id) return null;
        const sessionId = session.session_id;
        const detail = [
          session.start_at ? sessionDate(session.start_at) : null,
          sessionTime(session.start_at, session.end_at),
          sessionIsCancelled(session) ? 'Cancelled' : session.class_room,
        ].filter(Boolean).join(' · ');
        return (
          <TappableRow
            key={sessionId}
            title={sessionTitle(session)}
            detail={detail}
            accent={session.subject_color}
            onPress={() => router.push({
              pathname: log ? '/log-session/[sessionId]' : '/session/[sessionId]',
              params: { sessionId },
            })}
          />
        );
      })}
    </Card>
  );
}

export function SessionAgenda({ sessions }: { sessions: TutorSession[] }) {
  const byDay = new Map<string, TutorSession[]>();
  for (const session of sessions) {
    if (!session.start_at || !session.session_id) continue;
    const key = adelaideDateKey(new Date(session.start_at));
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  if (byDay.size === 0) return <EmptyBlock>No sessions in this period.</EmptyBlock>;

  return [...byDay.entries()].map(([day, rows]) => (
    <View key={day} style={{ gap: 8 }}>
      <SectionTitle>{sessionDate(rows[0]!.start_at!)}</SectionTitle>
      <SessionRows sessions={rows} />
    </View>
  ));
}
