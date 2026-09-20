import { useLessonNavigation } from "@/features/learning/lesson-navigation";
import { BottomToolbar } from "@/components/bottom-toolbar";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { openBrowserAsync } from "expo-web-browser";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { RichContent } from "@/components/rich-content";
import { LessonQuestion } from "@/features/learning/components/lesson-question";
import type { LearningLessonDetail } from "@/features/learning/types";
import { api } from "@/lib/api";
export default function Lesson() {
  const { id, taskId } = useLocalSearchParams<{
    id: string;
    taskId?: string;
  }>();
  const router = useRouter();
  const navigationRef = useLessonNavigation();
  const client = useQueryClient();
  const viewport = useRef(0);
  const contentHeight = useRef(0);
  const requested = useRef(new Set<string>());
  const [failedBlocks, setFailedBlocks] = useState<Record<string, unknown>>({});
  const pendingSaves = useRef(new Map<string, Promise<unknown>>());
  const [openedMedia, setOpenedMedia] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [fileError, setFileError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => api<LearningLessonDetail>(`/learning-modules/${id}`),
  });
  const started = Boolean(q.data?.module.started_at);
  const block = q.data?.blocks[index];
  const content =
    block?.content &&
    typeof block.content === "object" &&
    !Array.isArray(block.content)
      ? block.content
      : {};
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["lesson", id] });
    void client.invalidateQueries({ queryKey: ["modules"] });
    void client.invalidateQueries({ queryKey: ["plan"] });
  };
  const start = useMutation({
    mutationFn: () =>
      api(`/learning-modules/${id}/start`, {
        method: "POST",
        body: { studyPlanTaskId: taskId ?? null },
      }),
    onSuccess: refresh,
  });
  const complete = useMutation({
    mutationFn: async (blockId: string) => {
      const request = api(`/learning-modules/blocks/${blockId}/progress`, {
        method: "PATCH",
        body: {
          completed: true,
          manuallyCompleted: false,
          interactionState: { scrollPercent: 100 },
        },
      });
      pendingSaves.current.set(blockId, request);
      try {
        return await request;
      } finally {
        pendingSaves.current.delete(blockId);
      }
    },
    retry: 3,
    onSuccess: async (_data, blockId) => {
      setFailedBlocks((previous) => {
        const next = { ...previous };
        delete next[blockId];
        return next;
      });
      await refresh();
    },
    onError: (error, blockId) =>
      setFailedBlocks((previous) => ({ ...previous, [blockId]: error })),
  });
  const finish = useMutation({
    mutationFn: async () => {
      await Promise.all([...pendingSaves.current.values()]);
      return api(`/learning-modules/${id}/complete`, { method: "POST" });
    },
    onSuccess: refresh,
  });
  async function openMedia() {
    setFileError(null);
    try {
      let url = typeof content.url === "string" ? content.url : "";
      if (block?.file_id) {
        const signed = await api<{ url: string }>(
          `/learning-modules/blocks/${block.id}/file?format=json`,
        );
        url = signed.url;
      }
      if (!/^https?:\/\//.test(url))
        throw new Error("This resource has no valid link.");
      await openBrowserAsync(url);
      setOpenedMedia(block?.id ?? null);
      if (
        block?.id &&
        !block.block_completed_at &&
        !requested.current.has(block.id)
      ) {
        requested.current.add(block.id);
        complete.mutate(block.id);
      }
    } catch (e) {
      setFileError(e);
    }
  }
  function reachedBottom() {
    if (
      !block?.id ||
      block.block_completed_at ||
      requested.current.has(block.id)
    )
      return;
    if (block.block_type !== "text" && openedMedia !== block.id) return;
    requested.current.add(block.id);
    complete.mutate(block.id);
  }
  useEffect(() => {
    navigationRef.current = {
      index,
      parts:
        q.data?.blocks.map((b, i) => ({
          id: b.id ?? String(i),
          title: `Part ${i + 1}`,
          complete: Boolean(b.block_completed_at),
        })) ?? [],
      jump: (index) => move(index),
    };
    return () => {
      navigationRef.current = null;
    };
  });
  function move(next: number) {
    viewport.current = 0;
    contentHeight.current = 0;
    setIndex(next);
  }
  return (
    <>
      <Screen
        bottomToolbar
        key={block?.id ?? "intro"}
        scrollEventThrottle={100}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          if (
            contentHeight.current > 0 &&
            contentHeight.current <= viewport.current
          )
            reachedBottom();
        }}
        onContentSizeChange={(_width, height) => {
          contentHeight.current = height;
          if (viewport.current > 0 && height <= viewport.current)
            reachedBottom();
        }}
        onScroll={({ nativeEvent: e }) => {
          if (
            e.contentOffset.y + e.layoutMeasurement.height >=
            e.contentSize.height - 24
          )
            reachedBottom();
        }}
      >
        <Stack.Screen options={{ title: q.data?.module.title ?? "Lesson" }} />
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ) : !started ? (
          <Group>
            <Copy large>{q.data?.module.title}</Copy>
            <Copy>{q.data?.module.description}</Copy>
            <Copy muted>{q.data?.module.estimated_minutes ?? 0} min</Copy>
            <Action
              title="Start lesson"
              disabled={start.isPending}
              onPress={() => start.mutate()}
            />
            {start.error && <Failure error={start.error} />}
          </Group>
        ) : block ? (
          <>
            <Copy muted>
              Part {index + 1} of {q.data?.blocks.length}
            </Copy>
            {block.block_type === "text" ? (
              <Group>
                <RichContent json={content.body ?? block.content} />
              </Group>
            ) : block.block_type === "question" ||
              block.block_type === "question_stem" ? (
              <LessonQuestion
                key={block.id}
                block={block}
                onCompleted={() => void refresh()}
              />
            ) : block.block_type === "skill_trainer" ? (
              <Group>
                <Copy>Practise this skill to complete the activity.</Copy>
                <Action
                  title="Open skill trainer"
                  onPress={() =>
                    router.push({
                      pathname: "/trainers",
                      params: { blockId: block.id ?? "" },
                    })
                  }
                />
              </Group>
            ) : (
              <Group>
                <Copy>
                  {typeof content.label === "string"
                    ? content.label
                    : block.block_type === "video"
                      ? "Lesson video"
                      : "Lesson file"}
                </Copy>
                <Action
                  title="Open resource"
                  onPress={() => void openMedia()}
                />
                {fileError ? <Failure error={fileError} /> : null}
              </Group>
            )}
            {block.block_completed_at && <Copy muted>✓ Completed</Copy>}
            {Object.entries(failedBlocks).map(([blockId, error]) => (
              <Failure
                key={blockId}
                error={error}
                retry={() => complete.mutate(blockId)}
              />
            ))}
            {index + 1 === (q.data?.blocks.length ?? 0) && (
              <Action
                title={
                  q.data?.module.completed_at
                    ? "Lesson complete"
                    : "Complete lesson"
                }
                disabled={
                  finish.isPending || Boolean(q.data?.module.completed_at)
                }
                onPress={() => finish.mutate()}
              />
            )}
            {finish.error && <Failure error={finish.error} />}
          </>
        ) : (
          <Group>
            <Copy>This lesson has no content yet.</Copy>
          </Group>
        )}
      </Screen>
      {started && block && (
        <BottomToolbar
          previous={() => move(index - 1)}
          next={() => move(index + 1)}
          previousDisabled={index === 0}
          nextDisabled={index + 1 >= (q.data?.blocks.length ?? 0)}
          progress={((index + 1) / (q.data?.blocks.length ?? 1)) * 100}
          onProgress={() => router.push("/lesson-navigator")}
          previousLabel="Previous part"
          nextLabel="Next part"
        />
      )}
    </>
  );
}
