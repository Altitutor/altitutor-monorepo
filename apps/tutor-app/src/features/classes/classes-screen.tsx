import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';

import { useHeaderActions } from '@/components/header-actions';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, TappableRow, TutorScreen } from '@/components/tutor-ui';
import { useTheme } from '@/hooks/use-theme';

import { getCalendarSubscription, listCalendarSessions, listClasses } from './api';
import { DayBoard, WeekStrip } from './class-calendar';
import { ChoicePills, ControlRow, OperationButton } from './operation-controls';
import { PastSessionsHistory, pastSessionsKey } from './past-sessions-history';
import { operationsKey, useUnloggedSessions } from './queries';
import { SessionAgenda, SessionRows } from './session-list';
import { addAdelaideDays, adelaideDateKey, adelaideDayRange, sessionDate, sessionIsCancelled, sessionTitle, type CalendarSpan } from './session-model';

type Section = 'timetable' | 'classes' | 'logs';
type Mode = CalendarSpan | 'list';

const sections: { value: Section; label: string }[] = [
  { value: 'timetable', label: 'Timetable' },
  { value: 'classes', label: 'My Classes' },
  { value: 'logs', label: 'Tutor logs' },
];
const modes: { value: Mode; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 'list', label: 'List' },
];

export function ClassesScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const theme = useTheme();
  const [section, setSection] = useState<Section>('timetable');
  const [mode, setMode] = useState<Mode>(1);
  const [anchor, setAnchor] = useState(() => new Date());
  const [hiddenClasses, setHiddenClasses] = useState<string[]>([]);
  const headerActions = useHeaderActions(process.env.EXPO_OS === 'ios' && section === 'timetable' ? modes.map((item) => ({
    label: item.label,
    selected: item.value === mode,
    onPress: () => setMode(item.value),
  })) : undefined);
  const classes = useQuery({ queryKey: [...operationsKey, 'classes'], queryFn: listClasses });
  const range = adelaideDayRange(addAdelaideDays(anchor, -7), 28);
  const sessions = useQuery({
    queryKey: [...operationsKey, 'sessions', range],
    queryFn: () => listCalendarSessions(range),
    enabled: section === 'timetable',
  });
  const unlogged = useUnloggedSessions();
  const calendar = useMutation({
    mutationFn: async () => {
      const { subscriptionUrl } = await getCalendarSubscription();
      if (process.env.EXPO_OS === 'ios') {
        try {
          await Linking.openURL(subscriptionUrl.replace(/^https?:\/\//, 'webcal://'));
          return;
        } catch {
          // If the device cannot open webcal, share the subscription address.
        }
      }
      await Share.share({ message: subscriptionUrl });
    },
  });
  const unloggedCount = unlogged.data?.length ?? 0;
  const classPills = (classes.data ?? []).flatMap((row) => row.id ? [
    { value: row.id, label: sessionTitle(row), color: row.subject_color },
  ] : []);
  const filteredSessions = useMemo(() => (sessions.data ?? []).filter(
    (row) => !row.class_id || !hiddenClasses.includes(row.class_id),
  ), [hiddenClasses, sessions.data]);
  const items = filteredSessions.flatMap((row) => row.start_at && row.session_id ? [{
    id: row.session_id,
    title: sessionTitle(row),
    start: row.start_at,
    end: row.end_at,
    color: row.subject_color,
    cancelled: sessionIsCancelled(row),
  }] : []);
  const sectionsWithCount = sections.map((option) => option.value === 'logs' && unloggedCount
    ? { ...option, label: `Tutor logs (${unloggedCount})` } : option);

  const sectionChooser = (
    <ChoicePills label="Classes section" options={sectionsWithCount} selected={[section]} onSelect={setSection} />
  );

  function openSession(sessionId: string) {
    router.push({ pathname: '/session/[sessionId]', params: { sessionId } });
  }

  if (section === 'timetable') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ ...headerActions, title: 'Classes', headerLargeTitleEnabled: false }} />
        <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
          {sectionChooser}
          {process.env.EXPO_OS !== 'ios' ? (
            <ChoicePills label="Calendar view" options={modes} selected={[mode]} onSelect={setMode} />
          ) : null}
          {classPills.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChoicePills wrap={false} label="Show class" options={classPills} selected={classPills.filter((option) =>
              !hiddenClasses.includes(option.value)).map(({ value }) => value)}
              onSelect={(id) => setHiddenClasses((current) => current.includes(id)
                ? current.filter((value) => value !== id) : [...current, id])} />
            </ScrollView>
          ) : null}
          <ControlRow>
            <OperationButton label="Previous" onPress={() => setAnchor((current) => addAdelaideDays(current, -(mode === 'list' ? 7 : mode)))} />
            <OperationButton label={sessionDate(anchor)} onPress={() => setAnchor(new Date())} />
            <OperationButton label="Next" onPress={() => setAnchor((current) => addAdelaideDays(current, mode === 'list' ? 7 : mode))} />
          </ControlRow>
          {sessions.isPending ? <LoadingBlock label="Loading timetable…" /> : null}
          {sessions.isError ? <ErrorBlock message={sessions.error.message} /> : null}
        </View>
        {mode === 'list' ? (
          <TutorScreen title="Classes" largeTitle={false}>
            <SessionAgenda sessions={filteredSessions.filter((row) => row.start_at &&
              adelaideDateKey(new Date(row.start_at)) >= adelaideDateKey(anchor))} />
          </TutorScreen>
        ) : (
          <>
            <View style={{ flexGrow: 0 }}><WeekStrip anchor={anchor} onSelect={setAnchor} /></View>
            <DayBoard
              anchor={anchor}
              span={mode}
              items={items}
              onOpen={openSession}
              onShift={(days) => setAnchor((current) => addAdelaideDays(current, days))}
            />
          </>
        )}
      </View>
    );
  }

  return (
    <TutorScreen title="Classes" largeTitle={false}
      refreshing={classes.isRefetching || unlogged.isRefetching}
      onRefresh={() => {
        if (section === 'classes') void classes.refetch();
        if (section === 'logs') {
          void client.refetchQueries({ queryKey: pastSessionsKey, type: 'active' });
          if (unlogged.isEnabled) void unlogged.refetch();
        }
      }}>
      <Stack.Screen options={headerActions} />
      {sectionChooser}
      {section === 'classes' ? (
        <>
          <ControlRow>
            <OperationButton label={calendar.isPending ? 'Preparing calendar…' : 'Add to calendar'}
              onPress={() => calendar.mutate()} disabled={calendar.isPending} />
          </ControlRow>
          {calendar.isError ? <ErrorBlock message={calendar.error.message} /> : null}
          {classes.isPending ? <LoadingBlock label="Loading your classes…" /> : null}
          {classes.isError ? <ErrorBlock message={classes.error.message} /> : null}
          {classes.data?.length === 0 ? <EmptyBlock>You are not assigned to any classes yet.</EmptyBlock> : null}
          {classes.data?.length ? (
            <Card divided>
              {classes.data.map((row) => {
                if (!row.id) return null;
                const classId = row.id;
                return (
                  <TappableRow key={classId} title={sessionTitle(row)} accent={row.subject_color}
                    detail={[row.schedule_summary_short, row.room].filter(Boolean).join(' · ')}
                    onPress={() => router.push({ pathname: '/class/[classId]', params: { classId } })} />
                );
              })}
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <SectionTitle>Unlogged sessions</SectionTitle>
          {unlogged.isError ? <ErrorBlock message={unlogged.error.message} /> : null}
          {unlogged.fetchStatus === 'fetching' && unlogged.isPending ? <LoadingBlock label="Checking for unlogged sessions…" /> : null}
          {unlogged.data?.length ? <SessionRows sessions={unlogged.data} log /> : null}
          {unlogged.data?.length === 0 ? <EmptyBlock>All caught up.</EmptyBlock> : null}
          <PastSessionsHistory />
        </>
      )}
    </TutorScreen>
  );
}
