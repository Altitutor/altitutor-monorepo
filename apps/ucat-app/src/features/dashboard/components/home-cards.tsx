import { Text, View } from "react-native";
import { Image } from "expo-image";
import { Action, Copy, Group, useColors } from "@/components/ui";
import { AppIcon, type IconName } from "@/components/app-icon";
import type { Activity } from "@/features/progress/api";
import {
  buildPracticeStreak,
  practiceStreakWeekday,
} from "@/features/progress/practice-streak";
import type {
  StudyPlanResponse,
  StudyGuidanceItem,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

export function TestCountdownCard({
  plan,
  onOpenPlan,
}: {
  plan: StudyPlanResponse;
  onOpenPlan: () => void;
}) {
  const c = useColors();
  const testDate = plan.profile?.testDate;
  const days = testDate
    ? Math.round(
        (Date.parse(`${testDate}T00:00:00Z`) -
          Date.parse(`${plan.today}T00:00:00Z`)) /
          86_400_000,
      )
    : null;
  const year = plan.profile?.testYear ?? Number(plan.today.slice(0, 4));
  return (
    <Group>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AppIcon name="calendar" color={c.accent} />
        <Copy muted>Your UCAT</Copy>
      </View>
      <Text
        selectable
        style={{
          color: c.text,
          fontSize: 38,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {days === null || days < 0
          ? `UCAT ${year}`
          : days === 0
            ? "Test day"
            : `${days} ${days === 1 ? "day" : "days"}`}
      </Text>
      {days !== null && days > 0 ? <Copy muted>until your UCAT</Copy> : null}
      <Copy muted>
        {testDate
          ? new Date(`${testDate}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Test date to be confirmed"}
      </Copy>
      <Action
        secondary
        title={testDate ? "View study plan" : "Set your test date"}
        onPress={onOpenPlan}
      />
    </Group>
  );
}

export function HomeStreakCard({ activity }: { activity: Activity }) {
  const c = useColors();
  const streak = buildPracticeStreak(activity.days, activity.timezone);
  return (
    <Group>
      <Copy muted>Current streak</Copy>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image
            source={{
              uri: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-6 4-8 0 4 1 5 2 5 2-3 2-6 1-10Z" fill="#FBBF24" stroke="#F59E0B" stroke-width="1.5"/></svg>')}`,
            }}
            style={{ width: 25, height: 28 }}
          />
          <Copy large>
            {streak.current} day{streak.current === 1 ? "" : "s"}
          </Copy>
        </View>
        <Text
          style={{
            color: c.secondary,
            flex: 1,
            textAlign: "right",
            fontSize: 13,
          }}
        >
          {streak.practicedToday
            ? "Extended today"
            : streak.current
              ? "Answer 1 question today"
              : "Answer 1 question to begin"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {streak.recentDays.map((day) => (
          <View
            key={day.dateKey}
            accessibilityLabel={`${day.dateKey}: ${day.practiced ? "practice completed" : "no practice"}`}
            style={{ alignItems: "center", gap: 7 }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: day.practiced ? "#FBBF24" : c.tint,
                borderWidth: 1,
                borderColor:
                  day.practiced || day.isToday ? "#F59E0B" : c.border,
                borderStyle: day.isToday && !day.practiced ? "dashed" : "solid",
              }}
            >
              <Text style={{ color: "#451A03", fontWeight: "700" }}>
                {day.practiced ? "✓" : ""}
              </Text>
            </View>
            <Text
              style={{
                color: day.isToday ? c.text : c.secondary,
                fontSize: 12,
              }}
            >
              {practiceStreakWeekday(day.dateKey)}
            </Text>
          </View>
        ))}
      </View>
    </Group>
  );
}

const activityLabels: Record<string, { label: string; icon: IconName }> = {
  learn: { label: "Learning", icon: "book" },
  skill_trainer: { label: "Skill trainer", icon: "brain" },
  practice: { label: "Practice", icon: "pencil" },
  section_benchmark: { label: "Question set", icon: "stack" },
  mock: { label: "Mock exam", icon: "timer" },
  review: { label: "Review", icon: "book" },
};
export function NextActivityCard({
  next,
  hasPlan,
  busy,
  onLaunch,
  onOpenPlan,
  onPractice,
}: {
  next: StudyPlanTask | StudyGuidanceItem | null;
  hasPlan: boolean;
  busy: boolean;
  onLaunch: () => void;
  onOpenPlan: () => void;
  onPractice: () => void;
}) {
  const c = useColors();
  const meta = next ? activityLabels[next.taskType] : null;
  return (
    <Group>
      <Text
        style={{
          color: c.secondary,
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 1,
        }}
      >
        {next
          ? `SUGGESTED ACTIVITY · ${meta?.label.toUpperCase() ?? "STUDY"}`
          : "YOUR NEXT STEP"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{ backgroundColor: c.tint, borderRadius: 12, padding: 10 }}
        >
          <AppIcon name={meta?.icon ?? "calendar"} color={c.accent} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Copy large>
            {next?.title ??
              (hasPlan ? "You’re caught up" : "Set your study goal")}
          </Copy>
          {next ? <Copy muted>{next.estimatedMinutes} min</Copy> : null}
        </View>
      </View>
      <Copy muted>
        {next?.description ??
          (hasPlan
            ? "Your planned activities are complete. Choose some extra practice or come back on your next study day."
            : "Add your test date and goal to get a personalised study plan.")}
      </Copy>
      <Action
        title={
          busy
            ? "Opening…"
            : next
              ? "Start activity"
              : hasPlan
                ? "Choose practice"
                : "Set up study plan"
        }
        disabled={busy}
        onPress={next ? onLaunch : hasPlan ? onPractice : onOpenPlan}
      />
    </Group>
  );
}
