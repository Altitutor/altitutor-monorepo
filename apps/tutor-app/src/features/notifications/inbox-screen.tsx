import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, formatDateTime, Label, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { inboxQueryKey, updateInbox, useInboxItem, useTutorInbox } from '@/features/notifications/inbox';
import { notificationFromPush, sessionFromInboxAction } from '@/features/notifications/notification-routing';
import { useTheme } from '@/hooks/use-theme';
import { tutorWebUrl } from '@/lib/tutor-web';
import { useAuth } from '@/providers/auth-provider';

type InboxRow = NonNullable<ReturnType<typeof useTutorInbox>['data']>[number];

export default function InboxScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { notificationId } = useLocalSearchParams<{ notificationId?: string }>();
  const focusedId = notificationFromPush({ destination: 'inbox', notificationId }) ?? undefined;
  const queries = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const inbox = useTutorInbox();
  const focused = useInboxItem(focusedId);
  const focusedItem = focused.data;
  const rows = focusedItem
    ? [focusedItem, ...(inbox.data ?? []).filter(({ id }) => id !== focusedId)]
    : inbox.data ?? [];
  const update = useMutation({
    mutationFn: (change: Parameters<typeof updateInbox>[1]) => updateInbox(session!.user.id, change),
    onSuccess: () => queries.invalidateQueries({ queryKey: inboxQueryKey(session?.user.id) }),
  });

  async function open(item: InboxRow) {
    setActionError(null);
    try {
      if (!item.read_at) await update.mutateAsync({ notificationIds: [item.id] });
      const sessionId = sessionFromInboxAction(item.action_url);
      if (sessionId) router.push({ pathname: '/session/[sessionId]', params: { sessionId } });
      else if (item.action_url === '/classes') router.navigate('/classes');
      else if (item.action_url === '/pay-tier') await openBrowserAsync(tutorWebUrl('/pay-tier'));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to open the update.');
    }
  }

  function action(label: string, onPress: () => void) {
    return (
      <Pressable accessibilityRole="button" disabled={update.isPending} onPress={onPress}
        style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color: theme.primary, fontWeight: '600' }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <TutorScreen title="Notifications" largeTitle={false}
      refreshing={inbox.isRefetching || (Boolean(focusedId) && focused.isRefetching)} onRefresh={() => {
        void inbox.refetch();
        if (focusedId) void focused.refetch();
      }}>
      {rows.some(({ read_at }) => !read_at) ? action('Mark all as read', () => update.mutate({ markAllRead: true })) : null}
      {inbox.isPending || (focusedId && focused.isPending) ? <LoadingBlock label="Loading notifications…" /> : null}
      {focusedId && focused.isSuccess && !focusedItem ? <EmptyBlock>This update is no longer available.</EmptyBlock> : null}
      {inbox.error || focused.error || update.error || actionError ? (
        <ErrorBlock message={actionError ?? update.error?.message ?? focused.error?.message ?? inbox.error?.message ?? 'Unable to load notifications.'} />
      ) : null}
      {inbox.isSuccess && rows.length === 0 ? <EmptyBlock>You’re all caught up.</EmptyBlock> : null}
      {rows.map((item) => {
        const hasAction = item.action_url === '/classes' || item.action_url === '/pay-tier' || Boolean(sessionFromInboxAction(item.action_url));
        return (
          <Card key={item.id}>
            <View style={{ gap: 6 }}>
              <Text accessibilityRole="header" selectable
                style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>
                {item.title ?? 'Tutor update'}
              </Text>
              <Label>{[item.id === focusedId && 'Opened from notification', !item.read_at && 'Unread',
                item.created_at && formatDateTime(item.created_at)].filter(Boolean).join(' · ')}</Label>
              {item.body ? <Text selectable style={{ color: theme.text, lineHeight: 22 }}>{item.body}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {hasAction ? action('Open', () => void open(item)) :
                !item.read_at ? action('Mark as read', () => update.mutate({ notificationIds: [item.id] })) : null}
              {action('Dismiss', () => update.mutate({ notificationIds: [item.id], dismiss: true }))}
            </View>
          </Card>
        );
      })}
    </TutorScreen>
  );
}
