import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, formatDateTime, Label, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { useSessionDetail } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

type Person = { first_name?: string; last_name?: string; name?: string };

function peopleLabel(value: unknown) {
  if (!Array.isArray(value)) return 'Not listed';
  const labels = value.map((person) => {
    const record = person as Person;
    return record.name ?? [record.first_name, record.last_name].filter(Boolean).join(' ');
  }).filter(Boolean);
  return labels.join(', ') || 'Not listed';
}

export default function SessionModalScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useSessionDetail(sessionId);
  const detail = session.data;
  const subject = detail
    ? `${detail.subject_year_level ? `Year ${detail.subject_year_level} ` : ''}${detail.subject_name ?? 'Tutoring session'}`
    : 'Session';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: subject,
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
      <StudentScreen title={subject} subtitle="Session details">
        {session.isPending ? <LoadingBlock label="Loading session..." /> : null}
        {session.isError ? <ErrorBlock message={session.error.message} /> : null}
        {!session.isPending && !detail ? <EmptyBlock>Session not found.</EmptyBlock> : null}
        {detail ? (
          <>
            <Card>
              <Label>Date and time</Label>
              <Value>{formatDateTime(detail.start_at)}</Value>
              <Label>Room</Label>
              <Value>{detail.room ?? 'To be confirmed'}</Value>
              <Label>Type</Label>
              <Value>{detail.session_type ?? 'Class'}</Value>
            </Card>
            <Card>
              <Label>Tutors</Label>
              <Value>{peopleLabel(detail.staff)}</Value>
              <Label>Students</Label>
              <Value>{peopleLabel(detail.students)}</Value>
              {detail.planned_absence ? (
                <>
                  <Label>Attendance</Label>
                  <Value>Planned absence recorded</Value>
                </>
              ) : null}
            </Card>
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
