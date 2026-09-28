import { Stack, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, Text } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, formatDateTime, Label, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { openWebProfile } from '@/features/settings/open-web-profile';
import { useNotifications, useUpdateNotifications } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';
import { studentWebUrl } from '@/lib/student-web';
import type { StudentNotification } from '@/lib/student-api';

export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const notifications = useNotifications();
  const update = useUpdateNotifications();
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
      <StudentScreen
        title="Notifications"
        refreshing={notifications.isRefetching}
        onRefresh={() => notifications.refetch()}
      >
        {notifications.isPending ? <LoadingBlock label="Loading notifications..." /> : null}
        {notifications.isError ? <ErrorBlock message={notifications.error.message} /> : null}
        {update.isError ? <ErrorBlock message={update.error.message} /> : null}
        {notifications.data?.length === 0 ? <EmptyBlock>You’re all caught up.</EmptyBlock> : null}
        {notifications.data?.map((notification) => (
          <Card key={notification.id}>
            <TappableRow
              title={notification.title ?? 'Notification'}
              detail={[notification.read_at ? null : 'Unread', formatDateTime(notification.created_at)].filter(Boolean).join(' · ')}
              onPress={() => openNotification(notification)}
            />
            {notification.body ? <Label>{notification.body}</Label> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear notification"
              onPress={() => update.mutate({ notificationIds: [notification.id], dismiss: true })}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Clear</Text>
            </Pressable>
          </Card>
        ))}
      </StudentScreen>
    </>
  );
}
