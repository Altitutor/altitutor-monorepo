import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, KeyValueRow, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { sessionDisplayTitle, sessionTypeLabel } from '@/features/sessions/session-display';
import { SessionLogFiles } from '@/features/sessions/session-log-files';
import { readSessionPeople, SessionPeopleRow } from '@/features/sessions/session-people';
import { useProfile, useSessionAttendance, useSessionDetail } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

function attendanceLabel(plannedAbsence: boolean | null, markedAbsent: boolean | null | undefined) {
  if (markedAbsent === true) return 'Absent';
  if (markedAbsent === false) return 'Attended';
  if (plannedAbsence) return 'Not attending';
  return 'Planning to attend';
}

export default function SessionModalScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useSessionDetail(sessionId);
  const attendance = useSessionAttendance(sessionId);
  const profile = useProfile();
  const detail = session.data;
  const subject = detail ? sessionDisplayTitle(detail) : 'Session';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: subject || 'Session',
          headerLargeTitleEnabled: false,
          headerTintColor: theme.primary,
          ...(process.env.EXPO_OS === 'android'
            ? {
                headerRight: () => (
                  <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeAction}>
                    <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
                  </Pressable>
                ),
              }
            : {}),
        }}
      />
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button accessibilityLabel="Close session" icon="xmark" onPress={() => router.back()} />
        </Stack.Toolbar>
      ) : null}
      <StudentScreen title={subject || 'Session'}>
        {session.isPending ? <LoadingBlock label="Loading session..." /> : null}
        {session.isError ? <ErrorBlock message={session.error.message} /> : null}
        {!session.isPending && !detail ? <EmptyBlock>Session not found.</EmptyBlock> : null}
        {detail ? (
          <>
            <Card>
              <KeyValueRow label="When"><Value align="right">{detail.start_at ? new Date(detail.start_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Adelaide' }) : 'Time to be confirmed'}</Value></KeyValueRow>
              <KeyValueRow label="Room"><Value align="right">{detail.room ?? 'To be confirmed'}</Value></KeyValueRow>
              <KeyValueRow label="Type"><Value align="right">{sessionTypeLabel(detail.session_type)}</Value></KeyValueRow>
              <KeyValueRow label="Attendance"><Value align="right">{attendanceLabel(detail.planned_absence, attendance.data)}</Value></KeyValueRow>
            </Card>
            <Card>
              <SessionPeopleRow label="Tutors" people={readSessionPeople(detail.staff)} currentStudentId={null} />
              <SessionPeopleRow label="Students" people={readSessionPeople(detail.students)} currentStudentId={profile.data?.id ?? null} />
            </Card>
            <SessionLogFiles sessionID={sessionId} />
          </>
        ) : null}
      </StudentScreen>
    </>
  );
}

const styles = StyleSheet.create({
  closeAction: { paddingHorizontal: 8, paddingVertical: 8 },
  closeText: { fontSize: 16, fontWeight: '600' },
});
