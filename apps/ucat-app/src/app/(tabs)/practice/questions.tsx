import { practiceSecondsPerQuestion } from "@/features/practice/pace";
import { Choice, PaceSlider } from "@/components/practice-controls";
import { HeaderActions } from "@/components/header-actions";
import { useCurrentAttempt } from "@/features/practice/components/current-attempt";
import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import { api } from "@/lib/api";
const keys = [
  "verbal_reasoning",
  "decision_making",
  "quantitative_reasoning",
  "situational_judgement",
];
export default function Practice() {
  const router = useRouter();
  const { beforeStart } = useCurrentAttempt();
  const sections = useQuery({
    queryKey: ["sections"],
    queryFn: dataApi.sections,
  });
  const quota = useQuery({ queryKey: ["quota"], queryFn: dataApi.quota });
  const [section, setSection] = useState(1);
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(false);
  const [pace, setPace] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const selected = sections.data?.find((s) => s.sectionNumber === section);
      if (!selected) throw new Error("Choose a section.");
      const seconds = practiceSecondsPerQuestion(
        selected.timePerQuestion,
        pace,
        timed,
      );
      const result = await api<{ id: string }>("/practice-sessions", {
        method: "POST",
        body: {
          sectionKey: keys[section - 1],
          ucatSectionId: selected.id,
          unlimited: false,
          filtersSnapshot: {
            section: keys[section - 1],
            unansweredOnly: true,
            incorrectOnly: false,
            categoryIds: [],
            timeMode: timed ? "speed" : "off",
            timeSpeedMultiplier: pace,
            customTimeMinutes: null,
            questionCount: count,
            timePerQuestionSeconds: seconds,
            reviewTiming: "atEnd",
          },
        },
      });
      router.push({
        pathname: "/exam",
        params: { kind: "practice", id: result.id },
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <HeaderActions />
      <Group dividers>
        {sections.isPending ? (
          <Loading />
        ) : sections.error ? (
          <Failure
            error={sections.error}
            retry={() => void sections.refetch()}
          />
        ) : (
          <Choice
            label="Section"
            value={section}
            onChange={setSection}
            options={
              sections.data?.map((s) => ({
                value: s.sectionNumber,
                label: s.name,
              })) ?? []
            }
          />
        )}
        <Choice
          label="Session length"
          value={count}
          onChange={setCount}
          options={[5, 10, 20, 40].map((value) => ({
            value,
            label: `${value} questions`,
          }))}
        />
      </Group>
      <Copy muted>
        Questions sharing a passage stay together, so the final count may vary.
      </Copy>
      <Group title="Timing">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Copy>Timed session</Copy>
          <Switch
            accessibilityLabel="Timed session"
            value={timed}
            onValueChange={setTimed}
          />
        </View>
        {timed && (
          <>
            <Copy>{pace === 1 ? "Exam pace" : `${pace}× exam pace`}</Copy>
            <PaceSlider value={pace} onChange={setPace} />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Copy muted>Slower</Copy>
              <Copy muted>Faster</Copy>
            </View>
            <Copy muted>
              The session timer uses the actual number of questions delivered
              and continues while you leave the app.
            </Copy>
          </>
        )}
      </Group>
      {quota.data && !quota.data.isQuotaExempt && (
        <Group title="Your allowance">
          {quota.data.areas
            .filter((a) => a.area === "practice")
            .map((a) => (
              <Copy key={a.area}>
                {a.used} of {a.limit} questions this {a.period}
              </Copy>
            ))}
        </Group>
      )}
      {error ? <Failure error={error} /> : null}
      <Action
        title={busy ? "Preparing…" : "Start practice"}
        disabled={busy || !sections.data?.length}
        onPress={() => {
          setError(null);
          void beforeStart(start).catch(setError);
        }}
      />
    </Screen>
  );
}
