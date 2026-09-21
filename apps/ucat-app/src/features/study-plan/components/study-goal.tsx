import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Action, Copy, Failure, Field, Group, Loading } from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import type { StudyPlanWeekday } from "@/features/study-plan/model/types";
import { api } from "@/lib/api";
export function StudyGoal() {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["plan"], queryFn: dataApi.plan });
  const [target, setTarget] = useState("2700");
  const [date, setDate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState<StudyPlanWeekday[]>([1, 3, 5]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (q.data?.profile) {
      setTarget(String(q.data.profile.targetScore));
      setDate(q.data.profile.testDate ?? "");
      setDays(q.data.profile.availableDays.map((d) => d.weekday));
      setEnabled(q.data.profile.studyPlanEnabled);
    }
  }, [q.data?.profile]);
  const save = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
        throw new Error("Enter your exam date as YYYY-MM-DD.");
      return api("/study-plan", {
        method: "PUT",
        body: {
          studyPlanEnabled: enabled,
          targetScore: Number(target),
          testYear: Number(date.slice(0, 4)),
          testDate: date,
          availableDays: days.map((weekday) => ({ weekday })),
          preferredMockWeekday: q.data?.profile?.preferredMockWeekday ?? 6,
          sjtPreference: q.data?.profile?.sjtPreference ?? "normally",
        },
      });
    },
    onSuccess: () => {
      setEditing(false);
      void client.invalidateQueries({ queryKey: ["plan"] });
    },
  });
  return (
    <>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data?.profile || editing ? (
            <Group title="Your goal">
              <Copy>Target score</Copy>
              <Field
                accessibilityLabel="Target score"
                keyboardType="number-pad"
                value={target}
                onChangeText={setTarget}
              />
              <Copy>Exam date</Copy>
              <Field
                accessibilityLabel="Exam date YYYY-MM-DD"
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Copy>Enable study plan</Copy>
                <Switch value={enabled} onValueChange={setEnabled} />
              </View>
              <Copy>Study days</Copy>
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, i) => (
                <View
                  key={day}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Copy>{day}</Copy>
                  <Switch
                    accessibilityLabel={day}
                    value={days.includes(i as StudyPlanWeekday)}
                    onValueChange={(v) =>
                      setDays(
                        v
                          ? [...days, i as StudyPlanWeekday]
                          : days.filter((d) => d !== i),
                      )
                    }
                  />
                </View>
              ))}
              <Action
                title="Save goal"
                disabled={save.isPending}
                onPress={() => save.mutate()}
              />
              {save.error && <Failure error={save.error} />}
            </Group>
          ) : (
            <Group>
              <Copy large>Target {q.data.profile.targetScore}</Copy>
              <Copy>
                {q.data.profile.testDate ?? "Exam date to be confirmed"}
              </Copy>
              <Action
                secondary
                title="Edit goal"
                onPress={() => setEditing(true)}
              />
            </Group>
          )}
        </>
      )}
    </>
  );
}
