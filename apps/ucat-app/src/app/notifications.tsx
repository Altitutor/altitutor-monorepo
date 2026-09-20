import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import type { UcatNotificationInbox } from "@/features/notifications/types";
export default function Notifications() {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<UcatNotificationInbox>("/notifications"),
  });
  const read = useMutation({
    mutationFn: () =>
      api("/notifications", { method: "PATCH", body: { markAllRead: true } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {Boolean(q.data?.unreadCount) && (
            <Action
              title="Mark all as read"
              disabled={read.isPending}
              onPress={() => read.mutate()}
            />
          )}
          {read.error && <Failure error={read.error} />}
          {q.data?.notifications.map((n) => (
            <Group key={n.id}>
              <Copy large>{n.title}</Copy>
              <Copy>{n.body}</Copy>
              <Copy muted>
                {n.read_at ? "Read" : "Unread"} ·{" "}
                {n.created_at
                  ? new Date(n.created_at).toLocaleDateString()
                  : ""}
              </Copy>
            </Group>
          ))}
          {!q.data?.notifications.length && (
            <Group>
              <Copy>You’re all caught up.</Copy>
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}
