import { Stack } from "expo-router/stack";
import { Redirect, useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";
import {
  Copy,
  Failure,
  Group,
  Loading,
  Row,
  Screen,
  useColors,
} from "@/components/ui";
import { useTrainers, trainerIcons } from "@/features/skill-trainer/catalogue";
export default function Trainers() {
  const params = useLocalSearchParams<{
    trainerKey?: string;
    taskId?: string;
    blockId?: string;
  }>();
  const query = useTrainers();
  const c = useColors();
  if (params.trainerKey || params.blockId)
    return <Redirect href={{ pathname: "/trainer-start", params }} />;
  const sections = [
    ...new Set(query.data?.trainers.map((t) => t.section_number) ?? []),
  ].sort((a, b) => a - b);
  return (
    <Screen>
      <Stack.Screen options={{ title: "Skill trainers" }} />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {sections.map((number) => {
            const trainers = query
              .data!.trainers.filter((t) => t.section_number === number)
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <View key={number} style={{ gap: 10 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: c.secondary,
                    textTransform: "uppercase",
                    paddingHorizontal: 4,
                  }}
                >
                  {trainers[0]?.section_name}
                </Text>
                {trainers.map((t) => (
                  <Group key={t.id} compact>
                    <Row
                      title={t.name}
                      icon={trainerIcons[t.key] ?? "brain"}
                      href={{
                        pathname: "/trainer-start",
                        params: { trainerKey: t.key },
                      }}
                    />
                  </Group>
                ))}
              </View>
            );
          })}
          {!sections.length && (
            <Copy muted>No skill trainers are available yet.</Copy>
          )}
        </>
      )}
    </Screen>
  );
}
