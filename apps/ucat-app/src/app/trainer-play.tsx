import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
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
  CalcKeySequence,
} from "@/features/skill-trainer/components/calculator";
import {
  NumberAnswer,
  NumberPad,
} from "@/features/skill-trainer/components/number-pad";
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
import { applyNumpadKey } from "@/features/skill-trainer/lib/numpad-input";
import { haptic } from "@/lib/haptics";
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
  const [sequence, setSequence] = useState<string[]>([]);
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
    if (state?.isCompleted) haptic("success");
  }, [state?.isCompleted]);
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
    if (session.submit(action)) {
      setAnswer("");
      setSequence([]);
    }
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
          title: state?.isCompleted
            ? "Session complete"
            : (catalogue.data?.trainers.find((t) => t.key === key)?.name ??
              "Skill trainer"),
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
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {header}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
          <Group>
            <View style={{ alignItems: "center", gap: 6, paddingVertical: 4 }}>
              <Image
                accessibilityIgnoresInvertColors
                source={
                  process.env.EXPO_OS === "ios"
                    ? "sf:trophy.fill"
                    : {
                        uri: `data:image/svg+xml;utf8,${encodeURIComponent(
                          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5M12 13v3M9 20h6"/></svg>`,
                        )}`,
                      }
                }
                tintColor={c.accent}
                style={{ width: 36, height: 36 }}
              />
              <Text
                selectable
                accessibilityLabel={`${state.attempt.score} points`}
                style={{
                  color: c.text,
                  fontSize: 48,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -1,
                }}
              >
                {state.attempt.score}
              </Text>
              <Text
                style={{
                  color: c.secondary,
                  fontSize: 13,
                  fontWeight: "700",
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                points
              </Text>
              {state.attempt.config_snapshot.streak_enabled &&
              state.attempt.streak_count >= 2 ? (
                <View
                  style={{
                    marginTop: 6,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor:
                      state.attempt.streak_count >= 10 ? "#FBBF24" : c.tint,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    accessibilityLabel={`${state.attempt.streak_count} in a row`}
                    style={{
                      color:
                        state.attempt.streak_count >= 10 ? "#451A03" : c.text,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    🔥 {state.attempt.streak_count} streak
                  </Text>
                </View>
              ) : null}
            </View>
          </Group>
          {error ? (
            <Failure error={error} retry={() => void session.retry()} />
          ) : null}
          <Action
            title="Practice again"
            disabled={busy}
            onPress={() => {
              setAnswer("");
              setSequence([]);
              void session.start(key);
            }}
          />
          <Action
            title="Back to skill trainers"
            secondary
            onPress={() => router.dismissTo("/trainers")}
          />
        </View>
        {session.prepared ? (
          <TrainerReview items={session.localReview} trainerKey={key} />
        ) : review.isPending ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Loading variant="card" count={2} />
          </View>
        ) : review.error ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Failure
              error={review.error}
              retry={() => void review.refetch()}
            />
          </View>
        ) : (
          <TrainerReview
            items={review.data?.review.items ?? []}
            trainerKey={key}
          />
        )}
      </View>
    );
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
            {(key === "mental_maths" || key === "calculator_maths") && (
              <>
                <Group>
                  <RichContent
                    json={content.question}
                    text={String(content.expression ?? "")}
                  />
                </Group>
                <Group>
                  <NumberAnswer
                    value={answer}
                    disabled={!canSubmit}
                    onBackspace={() => numericKey("Backspace")}
                  />
                </Group>
              </>
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
                <Copy muted>Target sequence</Copy>
                <CalcKeySequence
                  labels={
                    Array.isArray(content.button_sequence)
                      ? content.button_sequence.map(String)
                      : []
                  }
                />
                <Copy muted>Your sequence</Copy>
                {sequence.length ? (
                  <CalcKeySequence labels={sequence} />
                ) : (
                  <Copy muted>Press keys on the calculator…</Copy>
                )}
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
          {(key === "mental_maths" || key === "calculator_maths") && (
            <View
              style={{
                padding: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                gap: 12,
                backgroundColor: c.background,
              }}
            >
              <NumberPad
                key={state.currentItem?.id}
                disabled={!canSubmit}
                onKey={numericKey}
              />
              <Action
                title="Submit"
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
            <View style={{ ...footerStyle, flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Action
                  title="No"
                  tone="danger"
                  disabled={!canSubmit}
                  onPress={() =>
                    submit({ type: "syllogism_answer", answer: false })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action
                  title="Yes"
                  tone="good"
                  disabled={!canSubmit}
                  onPress={() =>
                    submit({ type: "syllogism_answer", answer: true })
                  }
                />
              </View>
            </View>
          )}
          {key === "numpad_speed" && (
            <View style={footerStyle}>
              <Calculator
                key={state.currentItem?.id}
                showDisplay={false}
                disabled={!canSubmit}
                onKey={(pressed) => {
                  if (!canSubmit) return;
                  if (pressed === "=") {
                    if (sequence.length)
                      submit({ type: "numpad_sequence", sequence });
                    return;
                  }
                  setSequence((current) => applyNumpadKey(current, pressed));
                }}
              />
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
                  if (disabled) return;
                  haptic("light");
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
