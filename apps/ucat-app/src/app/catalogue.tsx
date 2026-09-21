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
import { learningSections } from "@/features/learning/library";
import { loadAttemptedIds } from "@/features/catalogue/attempted";
import { ExamCard } from "@/features/catalogue/exam-card";

export default function Catalogue() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [search, setSearch] = useState("");
  const mocks = useQuery({
    queryKey: ["mocks"],
    queryFn: dataApi.mocks,
    enabled: kind !== "set",
  });
  const attempted = useQuery({
    queryKey: ["attempted", "mock"],
    queryFn: () => loadAttemptedIds("mock"),
    enabled: kind !== "set",
  });
  const mockRows =
    mocks.data?.filter((m) =>
      (m.display_name ?? m.name ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
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
      {kind !== "mock" &&
        learningSections
          .filter((s) => s.number > 0)
          .map((section) => (
            <Group key={section.number}>
              <Row
                title={section.title}
                icon={section.icon}
                href={{
                  pathname: "/set-section",
                  params: { number: section.number },
                }}
              />
            </Group>
          ))}
      {kind !== "set" && (
        <>
          <Field
            accessibilityLabel="Search mocks"
            placeholder="Search mocks"
            value={search}
            onChangeText={setSearch}
          />
          {mocks.isPending || attempted.isPending ? (
            <Loading />
          ) : mocks.error ? (
            <Failure error={mocks.error} retry={() => void mocks.refetch()} />
          ) : attempted.error ? (
            <Failure
              error={attempted.error}
              retry={() => void attempted.refetch()}
            />
          ) : (
            <>
              {mockRows.map(
                (m) =>
                  m.id && (
                    <ExamCard
                      key={m.id}
                      id={m.id}
                      kind="mock"
                      title={m.display_name ?? m.name ?? "Mock exam"}
                      attempted={attempted.data?.includes(m.id) ?? false}
                    />
                  ),
              )}
              {!mockRows.length && (
                <Copy muted>
                  {search
                    ? "No mock exams match your search."
                    : "No mock exams are available yet."}
                </Copy>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
