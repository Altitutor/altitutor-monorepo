import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { dataApi } from "@/features/dashboard/api";
import { withHaptic } from "@/lib/haptics";
import { useColors } from "@/components/ui";
import {
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
  getTodayStudyPlanProgress,
} from "../companion";
export function useStudyCompanion() {
  const query = useQuery({ queryKey: ["plan"], queryFn: dataApi.plan });
  const data = query.data;
  const tasks = data ? selectCurrentStudyPlanTasks(data.tasks, data.today) : [];
  const task = data?.profile?.studyPlanEnabled
    ? selectNextStudyPlanTask(tasks)
    : null;
  const next = task ?? data?.nextSteps[0] ?? null;
  return {
    query,
    next,
    progress: getTodayStudyPlanProgress(data?.todayTasks ?? []),
  };
}
export function StudyOrb() {
  const router = useRouter();
  const c = useColors();
  const { query, next, progress } = useStudyCompanion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open study orb"
      onPress={withHaptic(() => router.push("/study-orb"))}
      style={{
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 28,
        backgroundColor: process.env.EXPO_OS === "ios" ? "transparent" : c.card,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: c.accent,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 12px ${c.accent}55`,
        }}
      >
        <Text style={{ color: c.card, fontSize: 23 }}>✦</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontWeight: "600" }}>
          {query.isPending
            ? "Preparing your next step…"
            : (next?.title ?? "Your study companion")}
        </Text>
        <Text style={{ color: c.secondary, fontSize: 12 }}>
          {progress.total
            ? `${progress.completed} of ${progress.total} activities today`
            : "Find your next step"}
        </Text>
      </View>
      <Text style={{ color: c.accent, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}
