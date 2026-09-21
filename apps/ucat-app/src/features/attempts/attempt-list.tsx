import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  useColors,
} from "@/components/ui";
import { attemptTitle } from "@/features/dashboard/api";
import { fetchAttempts, type AttemptKind } from "./api";
export function AttemptList({
  source,
  sectionNumber,
}: {
  source: AttemptKind;
  sectionNumber?: string;
}) {
  const router = useRouter();
  const c = useColors();
  const q = useInfiniteQuery({
    queryKey: ["attempts", source, sectionNumber],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchAttempts(source, pageParam, sectionNumber),
    getNextPageParam: (last, pages) =>
      pages.reduce((n, p) => n + p.attempts.length, 0) < last.total
        ? pages.length + 1
        : undefined,
  });
  return (
    <Group
      title={
        source === "practice"
          ? "Practice session attempts"
          : source === "mock"
            ? "Mock attempts"
            : "Set attempts"
      }
      dividers
    >
      {q.isPending ? (
        <Loading variant="rows" count={4} />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {q.data.pages
            .flatMap((p) => p.attempts)
            .map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/review",
                    params: { kind: a.source, id: a.id },
                  })
                }
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 0.5,
                  borderColor: c.border,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: c.text,
                      fontSize: 17,
                      fontWeight: "600",
                    }}
                  >
                    {attemptTitle(a)}
                  </Text>
                  <Copy muted>›</Copy>
                </View>
                <Text style={{ color: c.secondary, fontSize: 14 }}>
                  {new Date(a.attemptedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  ·{" "}
                  {a.scorePoints == null
                    ? "Score pending"
                    : `${a.scorePoints} / ${a.totalPoints ?? "—"} points`}
                </Text>
              </Pressable>
            ))}
          {!q.data.pages[0]?.total && (
            <Copy muted>No completed attempts yet.</Copy>
          )}
          {q.hasNextPage && (
            <Action
              secondary
              title={q.isFetchingNextPage ? "Loading…" : "Show more"}
              disabled={q.isFetchingNextPage}
              onPress={() => void q.fetchNextPage()}
            />
          )}
        </>
      )}
    </Group>
  );
}
