import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Failure,
  Field,
  Loading,
  Screen,
  useColors,
} from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import { learningSections } from "@/features/learning/library";
import { loadAttemptedIds } from "@/features/catalogue/attempted";
import { ExamCard } from "@/features/catalogue/exam-card";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";

export default function SetSection() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const sectionNumber = Number(number);
  const c = useColors();
  const section = learningSections.find((s) => s.number === sectionNumber);
  const [search, setSearch] = useState("");
  const sets = useQuery({ queryKey: ["sets"], queryFn: dataApi.sets });
  const attempted = useQuery({
    queryKey: ["attempted", "set"],
    queryFn: () => loadAttemptedIds("set"),
  });
  const rows = (sets.data ?? [])
    .filter((s) => s.section_number === sectionNumber)
    .map((s) => ({
      ...s,
      title:
        s.display_name ??
        (extractTextFromRichJson(s.name as JsonLike) || "Question set"),
    }))
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));
  const groups = [
    {
      title: "Full section sets",
      rows: rows.filter((s) => s.set_format === "full_section"),
    },
    {
      title: "Partial section sets",
      rows: rows.filter((s) => s.set_format === "partial_section"),
    },
    { title: "Other sets", rows: rows.filter((s) => !s.set_format) },
  ].filter((g) => g.rows.length);
  return (
    <Screen>
      <Stack.Screen options={{ title: section?.title ?? "Question sets" }} />
      <Field
        accessibilityLabel="Search sets"
        placeholder="Search sets"
        value={search}
        onChangeText={setSearch}
      />
      {sets.isPending || attempted.isPending ? (
        <Loading variant="list" />
      ) : sets.error ? (
        <Failure error={sets.error} retry={() => void sets.refetch()} />
      ) : attempted.error ? (
        <Failure
          error={attempted.error}
          retry={() => void attempted.refetch()}
        />
      ) : (
        <>
          {groups.map((group) => (
            <View key={group.title} style={{ gap: 10 }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: c.secondary,
                  fontSize: 13,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  paddingHorizontal: 4,
                }}
              >
                {group.title}
              </Text>
              {group.rows.map(
                (s) =>
                  s.id && (
                    <ExamCard
                      key={s.id}
                      id={s.id}
                      kind="set"
                      title={s.title}
                      attempted={attempted.data?.includes(s.id) ?? false}
                    />
                  ),
              )}
            </View>
          ))}
          {!rows.length && (
            <Copy muted>
              {search
                ? "No question sets match your search."
                : "No question sets are available for this section yet."}
            </Copy>
          )}
        </>
      )}
    </Screen>
  );
}
