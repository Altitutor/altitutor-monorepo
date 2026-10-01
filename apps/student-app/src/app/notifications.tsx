import { Stack, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { NotificationRow } from '@/features/notifications/notification-row';
import { openWebProfile } from '@/features/settings/open-web-profile';
import { useNotifications, useUpdateNotifications } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';
import type { StudentNotification } from '@/lib/student-api';
import { studentWebUrl } from '@/lib/student-web';

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const notifications = useNotifications();
  const update = useUpdateNotifications();
  const openRow = useRef<{ close: () => void } | null>(null);
  const unread = (notifications.data ?? []).filter((notification) => !notification.read_at).length;

  function openNotification(notification: StudentNotification) {
    if (!notification.read_at) update.mutate({ notificationIds: [notification.id] });
    const action = notification.action_url;
    if (!action) return;
    if (action === '/settings/profile') {
      void openWebProfile();
      return;
    }
    if (action.startsWith('http://') || action.startsWith('https://')) {
      void openBrowserAsync(action);
      return;
    }
    if (action.startsWith('/') && !action.startsWith('//')) {
      router.back();
      void openBrowserAsync(studentWebUrl(action));
    }
  }

  return (
    <>
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            hidden={unread === 0}
            disabled={update.isPending || unread === 0}
            accessibilityLabel="Mark all as read"
            onPress={withHaptic(() => update.mutate({ markAllRead: true }))}
          >
            Read All
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : unread > 0 ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
                disabled={update.isPending}
                onPress={withHaptic(() => update.mutate({ markAllRead: true }))}
                style={{ padding: 12, opacity: update.isPending ? 0.4 : 1 }}
              >
                <Text style={{ color: theme.primary, fontWeight: '600' }}>Read All</Text>
              </Pressable>
            ),
          }}
        />
      ) : null}
      <StudentScreen title="Notifications" refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()}>
        {notifications.isPending ? <LoadingBlock label="Loading notifications..." /> : null}
        {notifications.isError ? <ErrorBlock message={notifications.error.message} /> : null}
        {update.isError ? <ErrorBlock message={update.error.message} /> : null}
        {notifications.data?.length === 0 ? <EmptyBlock>You’re all caught up.</EmptyBlock> : null}
        {notifications.data?.map((notification) => (
          <Animated.View key={notification.id} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)}>
            <NotificationRow
              notification={notification}
              onOpen={() => openNotification(notification)}
              onToggleRead={() =>
                update.mutate(
                  notification.read_at
                    ? { notificationIds: [notification.id], markUnread: true }
                    : { notificationIds: [notification.id] },
                )
              }
              onClear={() => {
                openRow.current = null;
                update.mutate({ notificationIds: [notification.id], dismiss: true });
              }}
              onSwipeOpen={(row) => {
                if (openRow.current && openRow.current !== row) openRow.current.close();
                openRow.current = row;
              }}
            />
          </Animated.View>
        ))}
      </StudentScreen>
    </>
  );
}
