import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, StudentScreen, TappableRow } from '@/components/student-ui';
import { useStudentClasses } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timetableDays = [1, 2, 3, 4, 5, 6, 0];

function formatTime(value: string | null) {
  if (!value) return '--:--';
  const [hours, minutes] = value.split(':');
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function ClassesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const classes = useStudentClasses();
  const byDay = useMemo(
    () => timetableDays.map((day) => ({
      day,
      entries: (classes.data ?? []).filter((row) => row.day_of_week === day),
    })),
    [classes.data],
  );

  return (
    <StudentScreen
      title="Classes"
      subtitle="Your enrolled subjects and weekly timetable."
      refreshing={classes.isRefetching}
      onRefresh={() => classes.refetch()}>
      {classes.isPending ? <LoadingBlock label="Loading classes..." /> : null}
      {classes.isError ? <ErrorBlock message={classes.error.message} /> : null}
      {classes.data?.length === 0 ? <EmptyBlock>You are not enrolled in a class yet.</EmptyBlock> : null}
      <SectionTitle>My classes</SectionTitle>
      {classes.data?.map((row) => (
        <Card key={row.class_id}>
          <TappableRow
            title={`${row.subject_year_level ? `Year ${row.subject_year_level} ` : ''}${row.subject_name ?? 'Class'}`}
            detail={`${days[row.day_of_week ?? 0]} · ${row.start_time ?? '--:--'} - ${row.end_time ?? '--:--'}${row.room ? ` · ${row.room}` : ''}`}
            accent={row.subject_color}
            onPress={row.class_id ? () => router.push({ pathname: '/(tabs)/classes/[classId]', params: { classId: row.class_id! } }) : undefined}
          />
        </Card>
      ))}
      {classes.data?.length ? <SectionTitle>Session timetable</SectionTitle> : null}
      {classes.data?.length ? (
        <View style={[styles.timetable, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
          {byDay.map(({ day, entries }) => (
            <View key={day} style={[styles.dayRow, { borderBottomColor: theme.border }]}>
              <View style={styles.dayLabel}>
                <Text style={[styles.dayShort, { color: theme.textSecondary }]}>{days[day].slice(0, 3).toUpperCase()}</Text>
              </View>
              <View style={styles.dayEvents}>
                {entries.length === 0 ? (
                  <Text style={[styles.emptyDay, { color: theme.textSecondary }]}>No sessions</Text>
                ) : entries.map((row) => (
                  <Pressable
                    key={`timetable-${row.class_id}`}
                    onPress={row.class_id ? () => router.push({ pathname: '/(tabs)/classes/[classId]', params: { classId: row.class_id! } }) : undefined}
                    style={[styles.event, { backgroundColor: theme.backgroundSelected, borderLeftColor: row.subject_color ?? theme.accent }]}>
                    <Text style={[styles.eventTime, { color: theme.textSecondary }]}>
                      {formatTime(row.start_time)} - {formatTime(row.end_time)}
                    </Text>
                    <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                      {row.subject_year_level ? `Year ${row.subject_year_level} ` : ''}{row.subject_name ?? 'Class'}
                    </Text>
                    {row.room ? <Text style={[styles.eventRoom, { color: theme.textSecondary }]}>{row.room}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  timetable: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 4,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  dayRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 54 },
  dayLabel: { width: 48, paddingTop: 10 },
  dayShort: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  dayEvents: { flex: 1, gap: 8 },
  emptyDay: { fontSize: 13, paddingVertical: 10 },
  event: { borderRadius: 12, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 8 },
  eventTime: { fontSize: 12, fontWeight: '600' },
  eventTitle: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  eventRoom: { fontSize: 12, marginTop: 2 },
});
