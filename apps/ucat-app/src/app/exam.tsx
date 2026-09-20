import { BottomToolbar } from "@/components/bottom-toolbar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { Stack } from "expo-router/stack";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openBrowserAsync } from "expo-web-browser";
import {
  usePreventRemove,
  type NavigationProp,
} from "expo-router/react-navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { HeaderActions } from "@/components/header-actions";
import { useExamTools } from "@/features/question-engine/components/exam-tools";
import { discardAttempt } from "@/features/practice/components/current-attempt";
import { useQueryClient } from "@tanstack/react-query";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  Row,
  Screen,
} from "@/components/ui";
import { RichContent } from "@/components/rich-content";
import { Question } from "@/features/question-engine/components/question";
import {
  loadExam,
  beginNativeExam,
  syncNativeExam,
  finishNativeExam,
  WebPracticeRequiredError,
} from "@/features/question-engine/api/native-exam-api";
import {
  enterSegment,
  remainingSeconds,
  segmentIndex,
  segmentsFor,
} from "@/features/question-engine/model/native-engine";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
  ExamEngineSnapshot,
} from "@/lib/ucat/exam-attempt/types";
import { api, ApiError, webUrl } from "@/lib/api";
import {
  restoreDraft,
  serializeDraft,
} from "@/features/question-engine/model/pending-draft";
export default function Exam() {
  const params = useLocalSearchParams<{
    id: string;
    kind: ExamAttemptKind;
    resume?: string;
    taskId?: string;
  }>();
  const router = useRouter();
  const rootNavigation =
    useNavigation<NavigationProp<{ "(tabs)": undefined }>>("/");
  const { session } = useAuth();
  const [canLeave, setCanLeave] = useState(false);
  const tools = useExamTools();
  const draftKey = `ucat-draft:${session?.user.id}:${kindFromParams(params.kind)}:${params.id}`;

  const client = useQueryClient();
  const [exam, setExam] = useState<QuestionEngineExam | null>(null);
  const [attempt, setAttempt] = useState<ActiveExamAttempt | null>(null);
  const [state, setState] = useState<ExamEngineSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  function confirmExit() {
    if (busy) return;
    if (!state || finished) {
      setCanLeave(true);
      return;
    }
    Alert.alert(
      "Exit this attempt?",
      "Save to continue later, or discard this attempt. Timed attempts keep running while you are away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit and discard attempt",
          style: "destructive",
          onPress: () => {
            void discard();
          },
        },
        {
          text: "Exit and save attempt",
          onPress: () => {
            void leave();
          },
        },
      ],
    );
  }
  useEffect(() => {
    tools.current = {
      questions: exam?.questions.map((q, index) => {
        const segment = state
          ? segmentsFor(exam)[segmentIndex(segmentsFor(exam), state)]
          : null;
        return {
          index,
          label: `Question ${index + 1}`,
          answered: Boolean(state?.responseSnapshots?.[q.id]),
          flagged: state?.flaggedIds.includes(q.id) ?? false,
          current: state?.currentIndex === index,
          disabled:
            busy ||
            !segment ||
            index < segment.start ||
            index >= segment.end ||
            remainingSeconds(
              attempt?.currentSegmentEndsAt ?? null,
              Date.now(),
            ) === 0,
        };
      }),
      jump: (index) => {
        if (!state || !exam || busy) return;
        const segment =
          segmentsFor(exam)[segmentIndex(segmentsFor(exam), state)];
        if (
          index < segment.start ||
          index >= segment.end ||
          remainingSeconds(
            attempt?.currentSegmentEndsAt ?? null,
            Date.now(),
          ) === 0
        )
          return;
        void transition({ ...state, currentIndex: index, phase: "question" });
      },
      exit: confirmExit,
      canReview: Boolean(state?.phase === "question" && !finished),
      review: () => {
        if (state && !busy) void transition({ ...state, phase: "review" });
      },
    };
    return () => {
      tools.current = null;
    };
  });
  usePreventRemove(Boolean(state && !finished && !canLeave), confirmExit);
  useEffect(() => {
    if (canLeave)
      rootNavigation.reset({
        index: 0,
        routes: [
          {
            name: "(tabs)",
            state: {
              index: 0,
              routes: [
                {
                  name: "practice",
                  state: { index: 0, routes: [{ name: "index" }] },
                },
              ],
            },
          },
        ],
      });
  }, [canLeave, rootNavigation]);
  const latest = useRef({ attempt, state, exam });
  useEffect(() => {
    latest.current = { attempt, state, exam };
  }, [attempt, state, exam]);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const discarding = useRef(false);
  const kind =
    params.kind === "set" || params.kind === "mock" ? params.kind : "practice";
  async function load() {
    setError(null);
    try {
      const loaded = await loadExam(kind, params.id);
      setExam(loaded);
    } catch (e) {
      setError(e);
    }
  }
  useEffect(() => {
    let cancelled = false;
    void loadExam(kind, params.id)
      .then((e) => {
        if (!cancelled) setExam(e);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, params.id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const save = useCallback(
    (next: ExamEngineSnapshot, seconds?: number | null, paused = false) => {
      const attemptId = latest.current.attempt?.attemptId;
      if (!attemptId) return Promise.resolve();
      const currentRevision = ++revision.current;
      const draft = AsyncStorage.setItem(
        draftKey,
        serializeDraft(attemptId, next),
      );
      const job = saving.current
        .catch(() => undefined)
        .then(async () => {
          await draft;
          const current = latest.current;
          if (!current.attempt || !current.exam) return;
          const result = await syncNativeExam(
            current.attempt,
            next,
            current.exam,
            seconds,
            paused,
          );
          if (latest.current.attempt)
            latest.current.attempt = {
              ...latest.current.attempt,
              currentSegmentEndsAt: result.currentSegmentEndsAt,
              setAttemptIdsBySetId:
                result.setAttemptIdsBySetId ??
                latest.current.attempt.setAttemptIdsBySetId,
            };
          if (revision.current === currentRevision)
            await AsyncStorage.removeItem(draftKey);
          setAttempt((a) =>
            a
              ? {
                  ...a,
                  currentSegmentEndsAt: result.currentSegmentEndsAt,
                  setAttemptIdsBySetId:
                    result.setAttemptIdsBySetId ?? a.setAttemptIdsBySetId,
                }
              : a,
          );
        });
      saving.current = job;
      return job;
    },
    [draftKey],
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (status) => {
      const current = latest.current;
      if (
        !discarding.current &&
        current.state &&
        current.attempt &&
        current.exam
      ) {
        void save(
          { ...current.state, activeQuestionTiming: null },
          undefined,
          status !== "active",
        ).catch(setError);
      }
    });
    return () => listener.remove();
  }, [save]);
  async function start() {
    if (!exam) return;
    setBusy(true);
    setError(null);
    try {
      const result = await beginNativeExam(
        kind,
        exam,
        params.resume === "true",
        params.taskId,
      );
      const saved = await AsyncStorage.getItem(draftKey);
      const restored = restoreDraft(
        result.attempt.engineSnapshot,
        result.attempt.attemptId,
        saved,
      );
      const restoredExam = { ...exam, ...result.attempt.examTiming };
      setExam(restoredExam);
      setAttempt(result.attempt);
      setState(restored);
      latest.current = {
        attempt: result.attempt,
        state: restored,
        exam: restoredExam,
      };
      if (
        ["marking", "mockScore", "practiceComplete"].includes(restored.phase)
      ) {
        setFinished(true);
        await client.invalidateQueries();
        return;
      }
      await save(restored);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function transition(next: ExamEngineSnapshot, seconds?: number | null) {
    setBusy(true);
    setError(null);
    try {
      await save(next, seconds);
      setState(next);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!attempt || !exam || !state) return;
    setBusy(true);
    setError(null);
    try {
      await save(state);
      await finishNativeExam(attempt, exam, state);
      await AsyncStorage.removeItem(draftKey);
      setFinished(true);
      await client.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (!attempt) return;
    discarding.current = true;
    setBusy(true);
    try {
      await saving.current.catch(() => undefined);
      await discardAttempt(attempt);
      await AsyncStorage.removeItem(draftKey);
      await client.invalidateQueries({ queryKey: ["active"] });
      setCanLeave(true);
    } catch (e) {
      discarding.current = false;
      setError(e);
      setBusy(false);
    }
  }
  async function leave() {
    if (!state || finished) {
      setCanLeave(true);
      return;
    }
    setBusy(true);
    try {
      await save(state, undefined, true);
      await client.invalidateQueries({ queryKey: ["active"] });
      setCanLeave(true);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  if (!exam)
    return (
      <Screen>
        {error ? (
          <Failure error={error} retry={() => void load()} />
        ) : (
          <Loading />
        )}
        {error instanceof WebPracticeRequiredError && (
          <Action
            title="Continue on UCAT web"
            onPress={() => {
              void openBrowserAsync(webUrl("/exam"));
            }}
          />
        )}
      </Screen>
    );
  const segments = segmentsFor(exam);
  const currentSegment = state ? segmentIndex(segments, state) : 0;
  const segment = segments[currentSegment];
  const seconds = remainingSeconds(attempt?.currentSegmentEndsAt ?? null, now);
  const expired = seconds === 0 || state?.showTimeExpiredDialog === true;
  const question = state ? exam.questions[state.currentIndex] : undefined;
  function nextSegment() {
    if (!state) return;
    if (expired && kind !== "practice") {
      // Recovery advances expired mock sections from the original deadline,
      // including time spent away. Starting a fresh timer here would grant
      // extra time between sections.
      setBusy(true);
      setError(null);
      void saving.current
        .then(async () => {
          const result = await api<{ active: ActiveExamAttempt | null }>(
            "/exam-attempts/active",
          );
          if (
            result.active?.attemptId === attempt?.attemptId &&
            result.active &&
            !["marking", "mockScore", "practiceComplete"].includes(
              result.active.engineSnapshot.phase,
            )
          ) {
            setAttempt(result.active);
            setState(result.active.engineSnapshot);
          } else {
            setFinished(true);
            await client.invalidateQueries();
          }
        })
        .catch(setError)
        .finally(() => setBusy(false));
      return;
    }
    const next = segments[currentSegment + 1];
    if (next) void transition(enterSegment(state, next), next.seconds);
    else void finish();
  }
  const errorView = error ? (
    <Failure
      error={error}
      retry={
        state
          ? () => {
              void save(state)
                .then(() => setError(null))
                .catch(setError);
            }
          : undefined
      }
    />
  ) : null;
  return (
    <>
      <Screen bottomToolbar>
        {state && !finished && (
          <HeaderActions
            onMenu={() => router.push("/exam-menu")}
            onCalculator={() => router.push("/calculator")}
            flagged={Boolean(
              question && state?.flaggedIds.includes(question.id),
            )}
            onFlag={
              state?.phase === "question" && question && !finished && !expired
                ? () => {
                    if (busy) return;
                    void transition({
                      ...state,
                      flaggedIds: state.flaggedIds.includes(question.id)
                        ? state.flaggedIds.filter((id) => id !== question.id)
                        : [...state.flaggedIds, question.id],
                    });
                  }
                : undefined
            }
          />
        )}
        <Stack.Screen
          options={{
            title: exam.title,
            headerBackVisible: !state || finished,
            gestureEnabled: !state || finished,
          }}
        />
        {!state ? (
          <>
            <Group>
              <Copy large>{exam.title}</Copy>
              <Copy>{exam.questions.length} questions</Copy>
              <Copy muted>
                {segments.some((s) => s.seconds)
                  ? "The timer continues if you leave the app. Your answers are saved as you progress."
                  : "Take your time. You can save and return to your attempt."}
              </Copy>
            </Group>
            {errorView}
            {error instanceof ApiError &&
            error.status === 409 &&
            error.body.active ? (
              <Action
                title="Resume active attempt"
                onPress={() => {
                  const active = error.body.active as ActiveExamAttempt;
                  router.replace({
                    pathname: "/exam",
                    params: {
                      kind: active.kind,
                      id: active.resourceId,
                      resume: "true",
                    },
                  });
                }}
              />
            ) : (
              <Action
                title={
                  busy
                    ? "Opening…"
                    : params.resume === "true"
                      ? "Resume attempt"
                      : "Begin"
                }
                disabled={busy}
                onPress={() => void start()}
              />
            )}
          </>
        ) : finished ? (
          <>
            <Group>
              <Copy large>Session complete</Copy>
              <Copy>Your answers and results have been saved.</Copy>
              <Action
                title="View results"
                onPress={() =>
                  router.replace({
                    pathname: "/review",
                    params: { kind, id: attempt?.attemptId ?? params.id },
                  })
                }
              />
            </Group>
          </>
        ) : (
          <>
            {errorView}
            {(seconds !== null || expired) && (
              <Group>
                <Copy>
                  {expired
                    ? "Time is up"
                    : `${Math.floor((seconds ?? 0) / 60)}:${String((seconds ?? 0) % 60).padStart(2, "0")} remaining`}
                </Copy>
              </Group>
            )}
            {expired ? (
              <Group>
                <Copy>
                  This section has ended. Continue to save your answers and move
                  on.
                </Copy>
                <Action
                  title={
                    currentSegment + 1 < segments.length
                      ? "Continue"
                      : "Finish attempt"
                  }
                  disabled={busy}
                  onPress={nextSegment}
                />
              </Group>
            ) : state.phase === "instructions" ? (
              <>
                <Group title="Instructions">
                  <RichContent
                    json={
                      exam.instructionsScreens[state.instructionsIndex]
                        ?.instructionsJson
                    }
                  />
                </Group>
                <Action
                  title="Continue"
                  disabled={busy}
                  onPress={nextSegment}
                />
              </>
            ) : state.phase === "review" ? (
              <>
                <Group title="Review this section">
                  {exam.questions
                    .slice(segment.start, segment.end)
                    .map((q, i) => (
                      <Row
                        key={q.id}
                        title={`Question ${segment.start + i + 1}${state.flaggedIds.includes(q.id) ? " · Flagged" : ""}`}
                        detail={
                          state.responseSnapshots?.[q.id]
                            ? "Response saved"
                            : "Unanswered"
                        }
                        onPress={() =>
                          void transition({
                            ...state,
                            phase: "question",
                            currentIndex: segment.start + i,
                          })
                        }
                      />
                    ))}
                </Group>
                <Action
                  title={
                    currentSegment + 1 < segments.length
                      ? "Finish section"
                      : "Submit answers"
                  }
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Submit this section?",
                      "You can review your answers after completing the attempt.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Submit", onPress: nextSegment },
                      ],
                    )
                  }
                />
              </>
            ) : question ? (
              <>
                <Copy muted>
                  Question {state.currentIndex + 1} of {exam.questions.length}
                </Copy>
                <Question
                  question={question}
                  answer={state.responseSnapshots?.[question.id]}
                  onAnswer={(answer) => {
                    if (busy) return;
                    const next = {
                      ...state,
                      responseSnapshots: {
                        ...state.responseSnapshots,
                        [question.id]: answer,
                      },
                      visitedQuestionIds: [
                        ...new Set([...state.visitedQuestionIds, question.id]),
                      ],
                    };
                    setState(next);
                    void save(next).catch(setError);
                  }}
                />
              </>
            ) : (
              <Failure
                error={new Error("The saved question could not be loaded.")}
              />
            )}
          </>
        )}
      </Screen>
      {state?.phase === "question" && !finished && !expired && (
        <BottomToolbar
          previous={() =>
            void transition({ ...state, currentIndex: state.currentIndex - 1 })
          }
          next={() =>
            void transition(
              state.currentIndex + 1 < segment.end
                ? { ...state, currentIndex: state.currentIndex + 1 }
                : { ...state, phase: "review" },
            )
          }
          previousDisabled={busy || state.currentIndex <= segment.start}
          nextDisabled={busy}
          onNavigator={() => router.push("/question-navigator")}
          nextLabel={
            state.currentIndex + 1 < segment.end
              ? "Next question"
              : "Review section"
          }
        />
      )}
    </>
  );
}

function kindFromParams(kind: string) {
  return kind === "set" || kind === "mock" ? kind : "practice";
}
