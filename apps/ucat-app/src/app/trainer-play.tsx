import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router/stack";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  extractSkillTrainerPlainText,
  findFindWordClickableTokens,
  type FindWordItemContent,
} from "@altitutor/shared";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  Screen,
  useColors,
} from "@/components/ui";
import { HeaderActions } from "@/components/header-actions";
import { RichContent } from "@/components/rich-content";
import {
  Calculator,
  CalculatorKeypad,
} from "@/features/skill-trainer/components/calculator";
import { FindWord } from "@/features/skill-trainer/components/find-word";
import { TrainerScoreBar } from "@/features/skill-trainer/components/feedback";
import {
  TrainerReview,
  type TrainerReviewData,
} from "@/features/skill-trainer/components/trainer-review";
import { useTrainerTools } from "@/features/skill-trainer/components/trainer-tools";
import { useTrainerSession } from "@/features/skill-trainer/hooks/use-trainer-session";
import { useTrainers } from "@/features/skill-trainer/catalogue";
import type { SubmitActionPayload } from "@/features/skill-trainer/types/attempt";
import { api } from "@/lib/api";
export default function TrainerPlay() {
  const params = useLocalSearchParams<{
    trainerKey: string;
    taskId?: string;
    blockId?: string;
  }>();
  const session = useTrainerSession(params);
  const { state, remaining, canSubmit, busy, pending, error, feedback } =
    session;
  const catalogue = useTrainers();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toolsRef = useTrainerTools();
  const [answer, setAnswer] = useState("");
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);
  const start = useEffectEvent(() => {
    void session.start(params.trainerKey);
  });
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start();
    }
  }, []);
  useEffect(() => {
    if (leaving && !state && !busy) router.dismissTo("/trainers");
  }, [leaving, state, busy, router]);
  function exit() {
    if (busy) return;
    Alert.alert(
      "Exit this trainer?",
      "This unfinished run will be discarded.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit and discard",
          style: "destructive",
          onPress: () => {
            setLeaving(true);
            void session.discard();
          },
        },
      ],
    );
  }
  usePreventRemove(Boolean(busy || (state && !state.isCompleted)), exit);
  useEffect(() => {
    toolsRef.current = { exit };
    return () => {
      toolsRef.current = null;
    };
  });
  const key = state?.attempt.config_snapshot.trainer_key ?? params.trainerKey;
  const content = state?.currentItem?.content ?? {};
  const review = useQuery({
    queryKey: ["trainer-review", state?.attempt.id],
    enabled: !!state?.isCompleted && pending === 0 && !session.prepared,
    queryFn: () =>
      api<{ review: TrainerReviewData }>(
        `/skill-trainer-attempts/${state?.attempt.id}?include=review`,
      ),
  });
  function submit(action: SubmitActionPayload) {
    if (session.submit(action)) setAnswer("");
  }
  function numericKey(value: string) {
    if (!canSubmit) return;
    if (value === "=") {
      if (answer.trim() && Number.isFinite(Number(answer)))
        submit({ type: "numeric_answer", answer: Number(answer) });
    } else if (value === "Backspace") setAnswer((a) => a.slice(0, -1));
    else if (value === "+/-")
      setAnswer((a) => (a.startsWith("-") ? a.slice(1) : "-" + a));
    else if (value !== "." || !answer.includes("."))
      setAnswer((a) => (a.length < 18 ? a + value : a));
  }
  const header = (
    <>
      <Stack.Screen
        options={{
          title:
            catalogue.data?.trainers.find((t) => t.key === key)?.name ??
            "Skill trainer",
          headerBackVisible: false,
          gestureEnabled: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: c.background },
        }}
      />
      <HeaderActions
        hideNotifications
        onMenu={
          state && !state.isCompleted
            ? () => router.push("/trainer-menu")
            : undefined
        }
        onCalculator={
          key === "calculator_maths" && state && !state.isCompleted
            ? () => router.push("/calculator")
            : undefined
        }
      />
    </>
  );
  if (!state)
    return (
      <Screen>
        {header}
        {error ? (
          <Failure
            error={error}
            retry={() => void session.start(params.trainerKey)}
          />
        ) : (
          <Loading variant="question" />
        )}
        <Action
          secondary
          title="Back to skill trainers"
          disabled={busy}
          onPress={() => router.dismissTo("/trainers")}
        />
      </Screen>
    );
  if (state.isCompleted)
    return (
      <Screen>
        {header}
        <Group>
          <Copy large>Session complete</Copy>
          <Copy>{state.attempt.score} points</Copy>
          {error ? (
            <Failure error={error} retry={() => void session.retry()} />
          ) : null}
          <Action
            title="Practice again"
            disabled={busy}
            onPress={() => {
              setAnswer("");
              void session.start(key);
            }}
          />
          <Action
            title="Back to skill trainers"
            secondary
            onPress={() => router.dismissTo("/trainers")}
          />
        </Group>
        {session.prepared ? (
          <TrainerReview items={session.localReview} trainerKey={key} />
        ) : review.isPending ? (
          <Loading variant="card" count={2} />
        ) : review.error ? (
          <Failure error={review.error} retry={() => void review.refetch()} />
        ) : (
          <TrainerReview
            items={review.data?.review.items ?? []}
            trainerKey={key}
          />
        )}
      </Screen>
    );
  const isNumeric = key === "mental_maths" || key === "calculator_maths";
  const progress = state.attempt.progress;
  const footerStyle = {
    padding: 12,
    paddingBottom: Math.max(insets.bottom, 12),
    gap: 8,
    backgroundColor: c.card,
    borderTopWidth: 0.5,
    borderColor: c.border,
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {header}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 8 }}>
        <TrainerScoreBar
          score={state.attempt.score}
          remaining={remaining}
          streak={state.attempt.streak_count}
          streakEnabled={state.attempt.config_snapshot.streak_enabled}
          feedback={feedback}
        />
        {error ? (
          <Failure error={error} retry={() => void session.retry()} />
        ) : !canSubmit &&
          (pending > 0 || remaining === 0 || session.completing) ? (
          <Copy muted>
            {remaining === 0
              ? "Finishing your run…"
              : "Loading the next challenge…"}
          </Copy>
        ) : null}
      </View>
      {key === "find_word" && state.currentItem ? (
        <FindWord
          key={state.currentItem?.id}
          content={content as FindWordItemContent}
          placedIds={
            progress?.type === "find_word" ? progress.placed_keyword_ids : []
          }
          disabled={!canSubmit}
          onPlace={(keywordId, characterIndex) =>
            submit({
              type: "place_word",
              keyword_id: keywordId,
              character_index: characterIndex,
            })
          }
        />
      ) : (
        <>
          <ScrollView
            key={state.currentItem?.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            {isNumeric && (
              <Group>
                <RichContent
                  json={content.question}
                  text={String(content.expression ?? "")}
                />
              </Group>
            )}
            {key === "quick_syllogism" && (
              <>
                <Group>
                  {Array.isArray(content.premises) &&
                    content.premises.map((p, i) => (
                      <Copy key={i}>{String(p)}</Copy>
                    ))}
                </Group>
                <Group>
                  <Copy>
                    {String(content.conclusion ?? content.statement ?? "")}
                  </Copy>
                </Group>
              </>
            )}
            {key === "numpad_speed" && (
              <Group>
                <Copy muted>Match this sequence</Copy>
                <Copy large>
                  {Array.isArray(content.button_sequence)
                    ? content.button_sequence.join(" ")
                    : ""}
                </Copy>
                <Copy>{answer || "Tap the calculator keys below"}</Copy>
              </Group>
            )}
            {key === "find_concept" && (
              <Concept
                content={content}
                disabled={!canSubmit}
                submit={submit}
              />
            )}
          </ScrollView>
          {isNumeric && (
            <View style={footerStyle}>
              <Text
                accessibilityLabel={`Your answer: ${answer || "empty"}`}
                style={{
                  color: c.text,
                  fontSize: 25,
                  fontVariant: ["tabular-nums"],
                  textAlign: "right",
                  paddingHorizontal: 8,
                }}
              >
                {answer || "Your answer"}
              </Text>
              <CalculatorKeypad
                numericOnly
                key={state.currentItem?.id}
                disabled={!canSubmit}
                onKey={numericKey}
              />
              <Action
                title="Submit answer"
                disabled={
                  !canSubmit ||
                  !answer.trim() ||
                  !Number.isFinite(Number(answer))
                }
                onPress={() =>
                  submit({ type: "numeric_answer", answer: Number(answer) })
                }
              />
            </View>
          )}
          {key === "quick_syllogism" && (
            <View style={{ ...footerStyle, flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="Yes"
                  disabled={!canSubmit}
                  onPress={() =>
                    submit({ type: "syllogism_answer", answer: true })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  title="No"
                  disabled={!canSubmit}
                  onPress={() =>
                    submit({ type: "syllogism_answer", answer: false })
                  }
                />
              </View>
            </View>
          )}
          {key === "numpad_speed" && (
            <View style={footerStyle}>
              <Calculator
                key={state.currentItem?.id}
                disabled={!canSubmit}
                onKey={(value) =>
                  setAnswer((a) => (a ? a + " " + value : value))
                }
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Action
                    secondary
                    title="Clear sequence"
                    disabled={!canSubmit}
                    onPress={() => setAnswer("")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Action
                    title="Submit sequence"
                    disabled={!canSubmit || !answer}
                    onPress={() =>
                      submit({
                        type: "numpad_sequence",
                        sequence: answer.split(" "),
                      })
                    }
                  />
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}
function Concept({
  content,
  disabled,
  submit,
}: {
  content: Record<string, unknown>;
  disabled: boolean;
  submit: (action: SubmitActionPayload) => void;
}) {
  const c = useColors();
  const passage = extractSkillTrainerPlainText(
    content.passage as Record<string, unknown> | undefined,
  );
  const tokens = findFindWordClickableTokens(passage);
  const occurrences = Array.isArray(content.occurrences)
    ? (content.occurrences as { start: number; end: number }[])
    : [];
  return (
    <>
      <Group>
        <Copy>Find “{String(content.concept ?? "")}”</Copy>
        <Copy muted>Tap words expressing this concept.</Copy>
      </Group>
      <Group>
        <Text style={{ fontSize: 18, lineHeight: 34, color: c.text }}>
          {tokens.map((token, i) => (
            <Text key={token.start}>
              {passage.slice(i === 0 ? 0 : tokens[i - 1].end, token.start)}
              <Text
                accessibilityRole="button"
                onPress={() => {
                  if (!disabled)
                    submit({
                      type: "click_occurrence",
                      occurrence_index: occurrences.findIndex(
                        (o) => token.start >= o.start && token.start < o.end,
                      ),
                    });
                }}
                style={{ color: c.accent }}
              >
                {token.text}
              </Text>
            </Text>
          ))}
          {tokens.length
            ? passage.slice(tokens[tokens.length - 1].end)
            : passage}
        </Text>
      </Group>
      <Action
        title="Next concept"
        disabled={disabled}
        onPress={() => submit({ type: "skip_concept" })}
      />
    </>
  );
}
