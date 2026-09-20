import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Failure,
  Field,
  Group,
  Loading,
  Row,
  Screen,
} from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
export default function Catalogue() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [search, setSearch] = useState("");
  const sets = useQuery({ queryKey: ["sets"], queryFn: dataApi.sets });
  const mocks = useQuery({ queryKey: ["mocks"], queryFn: dataApi.mocks });
  return (
    <Screen>
      <Stack.Screen
        options={{
          title:
            kind === "set"
              ? "Question sets"
              : kind === "mock"
                ? "Mock exams"
                : "Exam library",
        }}
      />
      <Field
        accessibilityLabel="Search exams"
        placeholder={
          kind === "set"
            ? "Search sets"
            : kind === "mock"
              ? "Search mocks"
              : "Search sets and mocks"
        }
        value={search}
        onChangeText={setSearch}
      />
      {kind !== "set" && (
        <Group title="Mock exams">
          {mocks.isPending ? (
            <Loading />
          ) : mocks.error ? (
            <Failure error={mocks.error} retry={() => void mocks.refetch()} />
          ) : (
            mocks.data
              ?.filter((m) =>
                (m.display_name ?? m.name ?? "")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map(
                (m) =>
                  m.id && (
                    <Row
                      key={m.id}
                      title={m.display_name ?? m.name ?? "Mock exam"}
                      detail={`${m.set_count ?? 0} sections`}
                      href={{
                        pathname: "/exam",
                        params: { kind: "mock", id: m.id },
                      }}
                    />
                  ),
              )
          )}
          {mocks.data?.length === 0 && (
            <Copy muted>No mock exams are available yet.</Copy>
          )}
        </Group>
      )}
      {kind !== "mock" && (
        <Group title="Question sets">
          {sets.isPending ? (
            <Loading />
          ) : sets.error ? (
            <Failure error={sets.error} retry={() => void sets.refetch()} />
          ) : (
            sets.data
              ?.filter((s) =>
                (s.display_name ?? extractTextFromRichJson(s.name as JsonLike))
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map(
                (s) =>
                  s.id && (
                    <Row
                      key={s.id}
                      title={
                        s.display_name ??
                        (extractTextFromRichJson(s.name as JsonLike) ||
                          "Question set")
                      }
                      detail={
                        s.time_limit_seconds
                          ? `${Math.ceil(s.time_limit_seconds / 60)} min`
                          : "Untimed"
                      }
                      href={{
                        pathname: "/exam",
                        params: { kind: "set", id: s.id },
                      }}
                    />
                  ),
              )
          )}
          {sets.data?.length === 0 && (
            <Copy muted>No question sets are available yet.</Copy>
          )}
        </Group>
      )}
    </Screen>
  );
}
