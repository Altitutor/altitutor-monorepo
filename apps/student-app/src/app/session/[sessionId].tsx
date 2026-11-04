import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, KeyValueRow, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { sessionDisplayTitle, sessionTypeLabel } from '@/features/sessions/session-display';
import { SessionLogFiles } from '@/features/sessions/session-log-files';
import { useProfile, useSessionAttendance, useSessionDetail } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

type Person = { id?: string; first_name?: string; last_name?: string; name?: string };

function people(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((person) => {
    if (!person || typeof person !== 'object') return [];
    return [person as Person];
  });
}

function personName(person: Person) {
  return person.name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed';
}

function attendanceLabel(plannedAbsence: boolean | null, markedAbsent: boolean | null | undefined) {
  if (markedAbsent === true) return 'Absent';
  if (markedAbsent === false) return 'Attended';
  if (plannedAbsence) return 'Not attending';
  return 'Planning to attend';
}

export default function SessionModalScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useSessionDetail(sessionId);
  const attendance = useSessionAttendance(sessionId);
  const profile = useProfile();
  const detail = session.data;
  const subject = detail ? sessionDisplayTitle(detail) : 'Session';

  useLayoutEffect(() => {
    navigation.setOptions({ title: subject || 'Session', headerShown: true });
  }, [navigation, subject]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: subject || 'Session',
          headerLargeTitleEnabled: false,
          headerTintColor: theme.primary,
          ...(Platform.OS === 'android'
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
      {Platform.OS === 'ios' ? (
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
              <PeopleRow label="Tutors" people={people(detail.staff)} currentStudentId={null} />
              <PeopleRow label="Students" people={people(detail.students)} currentStudentId={profile.data?.id ?? null} />
            </Card>
            <SessionLogFiles sessionID={sessionId} />
          </>
        ) : null}
      </StudentScreen>
    </>
  );
}

function PeopleRow({ label, people: persons, currentStudentId }: { label: string; people: Person[]; currentStudentId: string | null }) {
  const theme = useTheme();
  return (
    <KeyValueRow label={label}>
      {persons.length === 0 ? <Value align="right">Not listed</Value> : persons.map((person) => (
        <View key={person.id ?? personName(person)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '500', textAlign: 'right' }}>{personName(person)}</Text>
          {currentStudentId && person.id === currentStudentId ? (
            <View style={{ backgroundColor: theme.backgroundSelected, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>You</Text>
            </View>
          ) : null}
        </View>
      ))}
    </KeyValueRow>
  );
}

const styles = StyleSheet.create({
  closeAction: { paddingHorizontal: 8, paddingVertical: 8 },
  closeText: { fontSize: 16, fontWeight: '600' },
});
