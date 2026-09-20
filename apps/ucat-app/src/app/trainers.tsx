import { Stack } from "expo-router/stack";
import { HeaderActions } from "@/components/header-actions";
import { useTrainerTools } from "@/features/skill-trainer/components/trainer-tools";
import {
  TrainerReview,
  type TrainerReviewItem,
  type TrainerReviewData,
} from "@/features/skill-trainer/components/trainer-review";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import {
  extractSkillTrainerPlainText,
  findFindWordClickableTokens,
} from "@altitutor/shared/types/ucat-skill-trainer";
import {
  Action,
  Copy,
  Failure,
  Field,
  Group,
  Loading,
  Row,
  Screen,
  useColors,
} from "@/components/ui";
import { RichContent } from "@/components/rich-content";
import { Calculator } from "@/features/skill-trainer/components/calculator";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import {
  submitLocalSkillTrainerAction,
  expireLocalSkillTrainerSession,
} from "@/features/skill-trainer/lib/local-session";
import { api, ApiError } from "@/lib/api";
type Trainer = {
  key: string;
  name: string;
  description: string | null;
  time_limit_seconds: number;
};
type Prepared = {
  session: SkillTrainerAttemptState;
  items: { id: string; content: Record<string, unknown> }[];
  trainerName: string;
};
export default function Trainers() {
  const params = useLocalSearchParams<{
    trainerKey?: string;
    taskId?: string;
    blockId?: string;
  }>();
  const router = useRouter();
  const toolsRef = useTrainerTools();
  const itemStartScore = useRef(0);
  const [localReview, setLocalReview] = useState<TrainerReviewItem[]>([]);
  const client = useQueryClient();
  const c = useColors();
  const catalogue = useQuery({
    queryKey: ["trainers"],
    queryFn: () => api<{ trainers: Trainer[] }>("/skill-trainers"),
  });
  const [state, setState] = useState<SkillTrainerAttemptState | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [keyword, setKeyword] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const review = useQuery({
    queryKey: ["trainer-review", state?.attempt.id],
    enabled: Boolean(state?.isCompleted && !prepared),
    queryFn: () =>
      api<{ review: TrainerReviewData }>(
        `/skill-trainer-attempts/${state?.attempt.id}?include=review`,
      ),
  });
  function exitTrainer() {
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
            setBusy(true);
            void (
              prepared || !state
                ? Promise.resolve()
                : api(`/skill-trainer-attempts/${state.attempt.id}`, {
                    method: "DELETE",
                  })
            )
              .then(() => {
                setState(null);
                setPrepared(null);
                setAnswer("");
                setKeyword("");
              })
              .catch(setError)
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  usePreventRemove(Boolean(state && !state.isCompleted), exitTrainer);
  useEffect(() => {
    toolsRef.current = { exit: exitTrainer };
    return () => {
      toolsRef.current = null;
    };
  });
  const remaining = state
    ? Math.max(0, Math.ceil((Date.parse(state.attempt.ends_at) - now) / 1000))
    : 0;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!state || state.isCompleted || remaining > 0) return;
    let cancelled = false;
    if (prepared) setState(expireLocalSkillTrainerSession(state));
    else
      void api<{ attempt: SkillTrainerAttemptState }>(
        `/skill-trainer-attempts/${state.attempt.id}`,
      )
        .then((result) => {
          if (!cancelled) setState(result.attempt);
        })
        .catch(setError);
    return () => {
      cancelled = true;
    };
  }, [remaining, state, prepared]);
  useEffect(() => {
    if (!state?.isCompleted) return;
    void client.invalidateQueries({ queryKey: ["plan"] });
    if (params.blockId)
      void api(`/learning-modules/blocks/${params.blockId}/complete`, {
        method: "POST",
      })
        .then(() => client.invalidateQueries({ queryKey: ["lesson"] }))
        .catch(setError);
  }, [state?.isCompleted, client, params.blockId]);
  async function start(key: string) {
    setBusy(true);
    setError(null);
    setLocalReview([]);
    itemStartScore.current = 0;
    setAnswer("");
    setKeyword("");
    try {
      if (params.blockId) {
        const p = await api<Prepared>(
          `/learning-modules/blocks/${params.blockId}/skill-trainer-session`,
        );
        setPrepared(p);
        setState(startPreparedSession(p));
      } else {
        const result = await api<{ attempt: SkillTrainerAttemptState }>(
          "/skill-trainer-attempts",
          {
            method: "POST",
            body: { trainerKey: key, studyPlanTaskId: params.taskId ?? null },
          },
        );
        setState(result.attempt);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit(action: SubmitActionPayload) {
    if (!state || busy || remaining === 0) return;
    setBusy(true);
    setError(null);
    try {
      const next = prepared
        ? submitLocalSkillTrainerAction(
            state,
            state.attempt.config_snapshot.trainer_key,
            action,
            new Map(prepared.items.map((i) => [i.id, i])),
          )
        : (
            await api<{ attempt: SkillTrainerAttemptState }>(
              `/skill-trainer-attempts/${state.attempt.id}/actions`,
              {
                method: "POST",
                body: {
                  actionId: randomUUID(),
                  expectedVersion: state.attempt.version,
                  action,
                },
              },
            )
          ).attempt;
      if (
        prepared &&
        state.currentItem &&
        (next.attempt.current_item_index !== state.attempt.current_item_index ||
          next.isCompleted)
      ) {
        const reviewScore = next.attempt.score - itemStartScore.current;
        itemStartScore.current = next.attempt.score;
        setLocalReview((items) => [
          ...items,
          {
            id: `${state.currentItem?.id}-${items.length}`,
            content: state.currentItem?.content ?? {},
            answer:
              "answer" in action
                ? action.answer
                : "sequence" in action
                  ? action.sequence
                  : action.type,
            correct: next.attempt.streak_count > state.attempt.streak_count,
            score_delta: reviewScore,
            elapsed_seconds: state.attempt.current_item_started_at
              ? Math.round(
                  (Date.now() -
                    Date.parse(state.attempt.current_item_started_at)) /
                    1000,
                )
              : null,
          },
        ]);
      }
      setState(next);
      setAnswer("");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.status === 409) {
        try {
          setState(
            (
              await api<{ attempt: SkillTrainerAttemptState }>(
                `/skill-trainer-attempts/${state.attempt.id}`,
              )
            ).attempt,
          );
        } catch (refreshError) {
          setError(refreshError);
        }
      }
    } finally {
      setBusy(false);
    }
  }
  const content = state?.currentItem?.content ?? {};
  const key = state?.attempt.config_snapshot.trainer_key;
  const passage = extractSkillTrainerPlainText(
    content.passage as Record<string, unknown> | undefined,
  );
  const tokens = findFindWordClickableTokens(passage);
  const keywords = Array.isArray(content.keywords)
    ? (content.keywords as { id: string; text: string }[])
    : [];
  const occurrences = Array.isArray(content.occurrences)
    ? (content.occurrences as { start: number; end: number }[])
    : [];
  const progress = state?.attempt.progress;
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerBackVisible: !state,
          gestureEnabled: !state,
          title: state
            ? (catalogue.data?.trainers.find(
                (t) => t.key === state.attempt.config_snapshot.trainer_key,
              )?.name ?? "Skill trainer")
            : "Skill trainers",
        }}
      />
      <HeaderActions
        hideNotifications={Boolean(state)}
        onMenu={
          state && !state.isCompleted
            ? () => router.push("/trainer-menu")
            : undefined
        }
      />
      {error ? <Failure error={error} /> : null}
      {!state ? (
        <>
          <Group>
            <Copy large>Sharpen one skill at a time.</Copy>
            <Copy muted>
              Short, focused challenges to build speed and accuracy.
            </Copy>
          </Group>
          {params.blockId ? (
            <Action
              title="Start lesson activity"
              disabled={busy}
              onPress={() => void start("")}
            />
          ) : catalogue.isPending ? (
            <Loading />
          ) : catalogue.error ? (
            <Failure
              error={catalogue.error}
              retry={() => void catalogue.refetch()}
            />
          ) : (
            <Group>
              {catalogue.data?.trainers
                .filter(
                  (t) => !params.trainerKey || t.key === params.trainerKey,
                )
                .map((t) => (
                  <Row
                    key={t.key}
                    title={t.name}
                    detail={`${t.time_limit_seconds}s · ${t.description ?? ""}`}
                    onPress={() => {
                      if (!busy) void start(t.key);
                    }}
                  />
                ))}
            </Group>
          )}
        </>
      ) : state.isCompleted ? (
        <>
          <Group>
            <Copy large>Session complete</Copy>
            <Copy>{state.attempt.score} points</Copy>
            <Action
              title="Practice again"
              disabled={busy}
              onPress={() =>
                void start(state.attempt.config_snapshot.trainer_key)
              }
            />
            <Action
              title="Back to skill trainers"
              secondary
              onPress={() => {
                setState(null);
                setPrepared(null);
                setAnswer("");
                setKeyword("");
                router.setParams({
                  trainerKey: undefined,
                  blockId: undefined,
                  taskId: undefined,
                });
              }}
            />
          </Group>
          {prepared ? (
            <TrainerReview
              items={localReview}
              trainerKey={state.attempt.config_snapshot.trainer_key}
            />
          ) : review.isPending ? (
            <Loading />
          ) : review.error ? (
            <Failure error={review.error} retry={() => void review.refetch()} />
          ) : (
            <TrainerReview
              items={review.data?.review.items ?? []}
              trainerKey={state.attempt.config_snapshot.trainer_key}
            />
          )}
        </>
      ) : (
        <>
          <Group>
            <Copy large>
              {remaining}s · {state.attempt.score} points
            </Copy>
            <Copy muted>Streak: {state.attempt.streak_count}</Copy>
          </Group>
          {(key === "mental_maths" || key === "calculator_maths") && (
            <>
              <Group>
                <RichContent
                  json={content.question}
                  text={String(content.expression ?? "")}
                />
                <Field
                  accessibilityLabel="Your answer"
                  keyboardType="numbers-and-punctuation"
                  placeholder="Your answer"
                  value={answer}
                  onChangeText={setAnswer}
                />
                <Action
                  title="Submit"
                  disabled={
                    busy ||
                    !answer.trim() ||
                    !Number.isFinite(Number(answer)) ||
                    remaining === 0
                  }
                  onPress={() =>
                    void submit({
                      type: "numeric_answer",
                      answer: Number(answer),
                    })
                  }
                />
              </Group>
              {key === "calculator_maths" && <Calculator />}
            </>
          )}
          {key === "quick_syllogism" && (
            <Group>
              {Array.isArray(content.premises) &&
                content.premises.map((p, i) => (
                  <Copy key={i}>{String(p)}</Copy>
                ))}
              <Copy large>
                {String(content.conclusion ?? content.statement ?? "")}
              </Copy>
              <Action
                title="Yes"
                disabled={busy || remaining === 0}
                onPress={() =>
                  void submit({ type: "syllogism_answer", answer: true })
                }
              />
              <Action
                title="No"
                disabled={busy || remaining === 0}
                onPress={() =>
                  void submit({ type: "syllogism_answer", answer: false })
                }
              />
            </Group>
          )}
          {key === "numpad_speed" && (
            <Group>
              <Copy large>
                {Array.isArray(content.button_sequence)
                  ? content.button_sequence.join(" ")
                  : ""}
              </Copy>
              <Copy>{answer || "Tap the sequence"}</Copy>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  "7",
                  "8",
                  "9",
                  "4",
                  "5",
                  "6",
                  "1",
                  "2",
                  "3",
                  "0",
                  ".",
                  "+",
                  "-",
                  "×",
                  "÷",
                  "=",
                ].map((k) => (
                  <Action
                    key={k}
                    title={k}
                    secondary
                    disabled={busy || remaining === 0}
                    onPress={() => setAnswer(answer ? `${answer} ${k}` : k)}
                  />
                ))}
              </View>
              <Action secondary title="Clear" onPress={() => setAnswer("")} />
              <Action
                title="Submit sequence"
                disabled={busy || !answer || remaining === 0}
                onPress={() =>
                  void submit({
                    type: "numpad_sequence",
                    sequence: answer.split(" "),
                  })
                }
              />
            </Group>
          )}
          {(key === "find_word" || key === "find_concept") && (
            <>
              <Group>
                {key === "find_word" ? (
                  <>
                    <Copy>
                      Select a keyword, then tap its occurrence in the passage.
                    </Copy>
                    {keywords.map((k) => (
                      <Action
                        key={k.id}
                        title={k.text}
                        secondary={keyword !== k.id}
                        disabled={
                          progress?.type === "find_word" &&
                          progress.placed_keyword_ids.includes(k.id)
                        }
                        onPress={() => setKeyword(k.id)}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <Copy large>{String(content.concept ?? "")}</Copy>
                    <Copy>Tap words expressing this concept.</Copy>
                  </>
                )}
              </Group>
              <Group>
                <Text style={{ fontSize: 18, lineHeight: 36, color: c.text }}>
                  {tokens.map((token, i) => (
                    <Text key={token.start}>
                      {passage.slice(
                        i === 0 ? 0 : tokens[i - 1].end,
                        token.start,
                      )}
                      <Text
                        accessibilityRole="button"
                        onPress={() => {
                          if (busy || remaining === 0) return;
                          if (key === "find_word" && keyword)
                            void submit({
                              type: "place_word",
                              keyword_id: keyword,
                              character_index: token.start,
                            });
                          else if (key === "find_concept") {
                            const occurrence = occurrences.findIndex(
                              (o) =>
                                token.start >= o.start && token.start < o.end,
                            );
                            void submit({
                              type: "click_occurrence",
                              occurrence_index: occurrence,
                            });
                          }
                        }}
                        style={{ color: c.accent }}
                      >
                        {token.text}
                      </Text>
                    </Text>
                  ))}
                  {tokens.length
                    ? passage.slice(tokens[tokens.length - 1].end)
                    : ""}
                </Text>
              </Group>
              {key === "find_concept" && (
                <Action
                  title="Next concept"
                  disabled={busy || remaining === 0}
                  onPress={() => void submit({ type: "skip_concept" })}
                />
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function startPreparedSession(p: Prepared): SkillTrainerAttemptState {
  const now = Date.now();
  return {
    ...p.session,
    attempt: {
      ...p.session.attempt,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(
        now + p.session.attempt.config_snapshot.time_limit_seconds * 1000,
      ).toISOString(),
      completed_at: null,
    },
    currentItem: p.items[0] ?? null,
    nextItem: p.items[1] ?? null,
    isCompleted: false,
    isExpired: false,
  };
}
