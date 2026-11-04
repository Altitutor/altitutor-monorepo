import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FilterPills } from '@/components/filter-pills';
import { HeaderActions } from '@/components/header-actions';
import { ErrorBlock, LoadingBlock } from '@/components/student-ui';
import { DayBoard, SessionList, WeekStrip, type CalendarItem } from '@/features/classes/class-calendar';
import { addAdelaideDays, sessionIsCancelled, type CalendarSpan } from '@/features/classes/calendar-model';
import { adelaideDateKey } from '@/features/dashboard/timetable';
import { sessionDisplayTitle } from '@/features/sessions/session-display';
import { useCalendarSessions, useStudentClasses } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

type CalendarMode = CalendarSpan | 'list';

const modes: { id: CalendarMode; label: string }[] = [
  { id: 1, label: '1 day' },
  { id: 3, label: '3 days' },
  { id: 7, label: '7 days' },
  { id: 'list', label: 'List' },
];

export default function ClassesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const classes = useStudentClasses();
  const [mode, setMode] = useState<CalendarMode>(1);
  const [anchor, setAnchor] = useState(() => new Date());
  const [hiddenClassIds, setHiddenClassIds] = useState<string[]>([]);
  const anchorKey = adelaideDateKey(anchor);
  const range = useMemo(() => {
    const day = new Date(`${anchorKey}T12:00:00+10:30`);
    return {
      from: addAdelaideDays(day, -21).toISOString(),
      to: addAdelaideDays(day, 35).toISOString(),
    };
  }, [anchorKey]);
  const sessions = useCalendarSessions(range.from, range.to);
  const items = useMemo<CalendarItem[]>(() => (sessions.data ?? []).flatMap((session) => {
    if (!session.session_id || !session.start_at) return [];
    if (session.class_id && hiddenClassIds.includes(session.class_id)) return [];
    return [{
      id: session.session_id,
      title: sessionDisplayTitle(session),
      start: session.start_at,
      end: session.end_at,
      color: session.subject_color,
      cancelled: sessionIsCancelled(session),
      classId: session.class_id,
    }];
  }), [sessions.data, hiddenClassIds]);
  const pills = useMemo(() => (classes.data ?? []).flatMap((row) => row.class_id ? [{
    id: row.class_id,
    label: sessionDisplayTitle(row),
    color: row.subject_color,
  }] : []), [classes.data]);
  const selectedClassIds = pills.map((pill) => pill.id).filter((id) => !hiddenClassIds.includes(id));

  function toggleClass(classId: string) {
    setHiddenClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Classes', headerLargeTitleEnabled: false }} />
      <HeaderActions viewMenu={modes.map((item) => ({
        label: item.label,
        selected: item.id === mode,
        onPress: () => setMode(item.id),
      }))} />
      {classes.isPending || sessions.isPending ? <LoadingBlock label="Loading classes..." /> : null}
      {classes.isError ? <ErrorBlock message={classes.error.message} /> : null}
      {sessions.isError ? <ErrorBlock message={sessions.error.message} /> : null}
      {pills.length ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <FilterPills choices={pills} selected={selectedClassIds} onSelect={toggleClass} />
        </View>
      ) : null}
      {classes.data?.length === 0 ? <Text selectable style={{ color: theme.textSecondary, padding: 20 }}>You are not enrolled in a class yet.</Text> : null}
      {mode === 'list' ? null : <WeekStrip anchor={anchor} onSelect={setAnchor} />}
      {mode === 'list'
        ? <SessionList items={items} onOpen={(id) => router.push({ pathname: '/session/[sessionId]', params: { sessionId: id } })} />
        : (
          <DayBoard
            anchor={anchor}
            span={mode}
            items={items}
            onOpen={(id) => router.push({ pathname: '/session/[sessionId]', params: { sessionId: id } })}
            onShift={(days) => setAnchor((current) => addAdelaideDays(current, days))}
          />
        )}
    </View>
  );
}
