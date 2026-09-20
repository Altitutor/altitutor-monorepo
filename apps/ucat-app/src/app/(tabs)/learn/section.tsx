import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import { HeaderActions } from "@/components/header-actions";
import {
  Copy,
  Failure,
  Field,
  Group,
  Loading,
  Row,
  Screen,
} from "@/components/ui";
import { learningSections, moduleIcon } from "@/features/learning/library";
import { dataApi } from "@/features/dashboard/api";
export default function LearningSection() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const section =
    learningSections.find((s) => s.number === Number(number)) ??
    learningSections[0];
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["modules"], queryFn: dataApi.modules });
  const modules =
    q.data?.filter((m) => (m.section_number ?? 0) === section.number) ?? [];
  const lessons = modules.filter(
    (m) =>
      m.kind === "lesson" &&
      (m.title ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const folders = modules.filter((m) => m.kind === "folder");
  const folderTitle = (id: string, seen = new Set<string>()): string => {
    const f = folders.find((f) => f.id === id);
    if (!f || seen.has(id)) return "Lessons";
    seen.add(id);
    return `${f.parent_ucat_learning_module_id ? folderTitle(f.parent_ucat_learning_module_id, seen) + " / " : ""}${f.title ?? "Lessons"}`;
  };
  const groups = [
    { id: null as string | null, title: "Lessons" },
    ...folders.map((f) => ({
      id: f.id,
      title: f.id ? folderTitle(f.id) : "Lessons",
    })),
  ]
    .map((g) => ({
      ...g,
      lessons: lessons.filter((m) =>
        g.id
          ? m.parent_ucat_learning_module_id === g.id
          : !folders.some((f) => f.id === m.parent_ucat_learning_module_id),
      ),
    }))
    .filter((g) => g.lessons.length);
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen
        options={{ title: section.title, headerLargeTitleEnabled: false }}
      />
      <HeaderActions />
      <Field
        accessibilityLabel="Search lessons"
        placeholder="Search lessons"
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {groups.map((g) => (
            <Group key={g.id ?? "root"} title={g.title}>
              {g.lessons.map(
                (m) =>
                  m.id && (
                    <Row
                      key={m.id}
                      title={m.title ?? "Lesson"}
                      icon={moduleIcon(m.icon_key)}
                      detail={`${m.estimated_minutes ?? 0} min · ${Math.round(m.completion_percent ?? 0)}% complete`}
                      href={{ pathname: "/lesson/[id]", params: { id: m.id } }}
                    />
                  ),
              )}
            </Group>
          ))}
          {!lessons.length && <Copy muted>No lessons match your search.</Copy>}
        </>
      )}
    </Screen>
  );
}
