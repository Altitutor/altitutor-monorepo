import { Image } from 'expo-image';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { selectTimetableSessions } from '@/features/dashboard/timetable';
import { useDueFlashcardCount } from '@/features/flashcards/flashcard-hooks';
import { sessionDisplayTitle } from '@/features/sessions/session-display';
import type { useDashboardSessions, useRecentResources } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import type { RecentResource, StudentSession } from '@/lib/student-api';

type SessionsQuery = ReturnType<typeof useDashboardSessions>;
type ResourcesQuery = ReturnType<typeof useRecentResources>;
type DueQuery = ReturnType<typeof useDueFlashcardCount>;

function formatSessionWhen(value: string, heading: 'Today' | 'Next session') {
  return new Intl.DateTimeFormat('en-AU', {
    ...(heading === 'Today' ? {} : { dateStyle: 'medium' as const }),
    timeStyle: 'short',
    timeZone: 'Australia/Adelaide',
  }).format(new Date(value));
}

function dueLabel(count: number) {
  if (count === 0) return 'No cards due';
  if (count === 1) return '1 card due';
  return `${count} cards due`;
}

export function DashboardHome({
  sessions,
  resources,
  due,
}: {
  sessions: SessionsQuery;
  resources: ResourcesQuery;
  due: DueQuery;
}) {
  const theme = useTheme();
  const timetable = selectTimetableSessions(sessions.data ?? []);
  const dueCount = due.data ?? 0;

  return (
    <View style={{ gap: 14 }}>
      <DashboardCard>
        <CardHeader title="Timetable" href="/(tabs)/classes" />
        {sessions.isPending ? <CardLoading /> : null}
        {sessions.isError ? <CardError message={sessions.error.message} /> : null}
        {sessions.data ? (
          <>
            <Text selectable style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{timetable.heading}</Text>
            {timetable.sessions.length === 0 ? (
              <Text selectable style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>No upcoming sessions</Text>
            ) : timetable.sessions.map((session) => (
              <SessionRow key={session.session_id ?? session.start_at} session={session} heading={timetable.heading} />
            ))}
          </>
        ) : null}
      </DashboardCard>

      <DashboardCard>
        <CardHeader title="Recent resources" />
        {resources.isPending ? <CardLoading /> : null}
        {resources.isError ? <CardError message={resources.error.message} /> : null}
        {resources.data?.length === 0 ? (
          <Text selectable style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 21 }}>No recent resources</Text>
        ) : null}
        {resources.data?.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} />
        ))}
      </DashboardCard>

      <Animated.View entering={FadeIn.duration(220)}>
        <Link href="/(tabs)/flashcards" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Flashcards, ${dueLabel(dueCount)}`}
            onPressIn={() => haptic()}
            style={{
              backgroundColor: theme.backgroundElement,
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 16,
              gap: 8,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>FLASHCARDS</Text>
              <Image source="sf:chevron.right" tintColor={theme.textSecondary} style={{ width: 12, height: 16 }} />
            </View>
            {due.isPending ? <CardLoading /> : null}
            {due.isError ? <CardError message={due.error.message} /> : null}
            {due.data != null ? (
              <Text selectable style={{ color: theme.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {dueLabel(dueCount)}
              </Text>
            ) : null}
          </Pressable>
        </Link>
      </Animated.View>
    </View>
  );
}

function DashboardCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        backgroundColor: theme.backgroundElement,
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 16,
        gap: 12,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}>
      {children}
    </Animated.View>
  );
}

function CardHeader({ title, href }: { title: string; href?: '/(tabs)/classes' }) {
  const theme = useTheme();
  const label = (
    <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>{title.toUpperCase()}</Text>
  );
  if (!href) return label;
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open timetable"
        onPressIn={() => haptic()}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {label}
        <Image source="sf:chevron.right" tintColor={theme.textSecondary} style={{ width: 12, height: 16 }} />
      </Pressable>
    </Link>
  );
}

function SessionRow({ session, heading }: { session: StudentSession; heading: 'Today' | 'Next session' }) {
  const theme = useTheme();
  if (!session.session_id || !session.start_at) return null;
  return (
    <Link href={{ pathname: '/session/[sessionId]', params: { sessionId: session.session_id } }} asChild>
      <Pressable accessibilityRole="button" onPressIn={() => haptic()} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {session.subject_color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: session.subject_color }} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{sessionDisplayTitle(session)}</Text>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>{formatSessionWhen(session.start_at, heading)}</Text>
        </View>
        <Image source="sf:chevron.right" tintColor={theme.textSecondary} style={{ width: 12, height: 16 }} />
      </Pressable>
    </Link>
  );
}

function ResourceRow({ resource }: { resource: RecentResource }) {
  const theme = useTheme();
  return (
    <Link
      href={{ pathname: '/resource-file/[fileId]', params: { fileId: resource.id, topicId: resource.topicId, title: resource.title } }}
      asChild>
      <Pressable accessibilityRole="button" onPressIn={() => haptic()} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{resource.title}</Text>
          {resource.detail ? <Text selectable style={{ color: theme.textSecondary, fontSize: 14 }}>{resource.detail}</Text> : null}
        </View>
        <Image source="sf:chevron.right" tintColor={theme.textSecondary} style={{ width: 12, height: 16 }} />
      </Pressable>
    </Link>
  );
}

function CardLoading() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.primary} />;
}

function CardError({ message }: { message: string }) {
  const theme = useTheme();
  return <Text selectable style={{ color: theme.danger, fontSize: 15, lineHeight: 21 }}>{message}</Text>;
}
