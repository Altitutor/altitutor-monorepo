import { useRef } from "react";
import { Pressable, RefreshControl, ScrollView, Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router/stack";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { Copy, Failure, Group, Loading, useColors } from "@/components/ui";
import { api } from "@/lib/api";
import {
  applyInboxCommand,
  inboxRequestBody,
  type InboxCommand,
} from "@/features/notifications/inbox";
import { NotificationRow } from "@/features/notifications/notification-row";
import type { UcatNotificationInbox } from "@/features/notifications/types";

type Closeable = { close: () => void };

export default function Notifications() {
  const c = useColors();
  const client = useQueryClient();
  const openRow = useRef<Closeable | null>(null);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<UcatNotificationInbox>("/notifications"),
  });
  const patch = useMutation({
    mutationFn: (command: InboxCommand) =>
      api("/notifications", {
        method: "PATCH",
        body: inboxRequestBody(command),
      }),
    onMutate: async (command) => {
      await client.cancelQueries({ queryKey: ["notifications"] });
      const previous = client.getQueryData<UcatNotificationInbox>([
        "notifications",
      ]);
      if (previous) {
        client.setQueryData(
          ["notifications"],
          applyInboxCommand(previous, command, new Date().toISOString()),
        );
      }
      return { previous };
    },
    onError: (_error, _command, context) => {
      if (context?.previous)
        client.setQueryData(["notifications"], context.previous);
    },
  });
  const unreadCount = q.data?.unreadCount ?? 0;
  const run = (command: InboxCommand) => patch.mutate(command);
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 20,
          gap: 10,
          width: "100%",
          maxWidth: 850,
          alignSelf: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(q.isRefetching)}
            onRefresh={() => void q.refetch()}
            tintColor={c.accent}
          />
        }
      >
        {q.isPending ? (
          <Loading variant="list" />
        ) : q.error ? (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            {patch.error ? <Failure error={patch.error} /> : null}
            {q.data.notifications.map((notification) => (
              <Animated.View
                key={notification.id}
                exiting={FadeOut.duration(180)}
                layout={LinearTransition.duration(220)}
              >
                <NotificationRow
                  notification={notification}
                  onToggleRead={() =>
                    run(
                      notification.read_at
                        ? { type: "unread", id: notification.id }
                        : { type: "read", id: notification.id },
                    )
                  }
                  onClear={() => {
                    openRow.current = null;
                    run({ type: "dismiss", id: notification.id });
                  }}
                  onSwipeOpen={(row) => {
                    if (openRow.current && openRow.current !== row)
                      openRow.current.close();
                    openRow.current = row;
                  }}
                />
              </Animated.View>
            ))}
            {!q.data.notifications.length ? (
              <Group>
                <Copy>You’re all caught up.</Copy>
              </Group>
            ) : null}
          </>
        )}
      </ScrollView>
      <ReadAllButton
        unreadCount={unreadCount}
        disabled={patch.isPending}
        onPress={() => run({ type: "readAll" })}
      />
    </>
  );
}

function ReadAllButton({
  unreadCount,
  disabled,
  onPress,
}: {
  unreadCount: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  if (process.env.EXPO_OS === "ios")
    return (
      <>
        <Stack.Screen options={{ headerLargeTitleEnabled: false }} />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            hidden={unreadCount === 0}
            disabled={disabled || unreadCount === 0}
            accessibilityLabel="Mark all as read"
            onPress={onPress}
          >
            Read All
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  return (
    <Stack.Screen
      options={{
        headerLargeTitleEnabled: false,
        headerRight:
          unreadCount === 0
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                  disabled={disabled}
                  onPress={onPress}
                  style={{ padding: 12, opacity: disabled ? 0.4 : 1 }}
                >
                  <Text style={{ color: c.accent, fontWeight: "600" }}>
                    Read All
                  </Text>
                </Pressable>
              ),
      }}
    />
  );
}
