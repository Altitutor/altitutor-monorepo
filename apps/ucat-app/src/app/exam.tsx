import { BottomToolbar } from "@/components/bottom-toolbar";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useMemo,
  useState,
} from "react";
import { Alert, AppState } from "react-native";
import { Stack } from "expo-router/stack";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openWebSettings } from "@/features/settings/open-web-settings";
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
import { api, ApiError } from "@/lib/api";
import {
  restoreDraft,
  serializeDraft,
} from "@/features/question-engine/model/pending-draft";
import { createDraftWriter } from "@/features/question-engine/model/draft-writer";
export default function Exam() {
  const params = useLocalSearchParams<{
    id: string;
    kind: ExamAttemptKind;
    resume?: string;
    taskId?: string;
    autoStart?: string;
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
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  function setBusy(value: boolean) {
    busyRef.current = value;
    setBusyState(value);
  }
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  function confirmExit() {
    if (busyRef.current) return;
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
          stemId: `${q.questionSetId}:${q.stemId}`,
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
        const state = latest.current.state;
        if (!state || !exam || busyRef.current) return;
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
        transition((current) => ({
          ...current,
          currentIndex: index,
          phase: "question",
        }));
      },
      exit: confirmExit,
      canReview: Boolean(state?.phase === "question" && !finished),
      review: () => {
        transition((current) => ({ ...current, phase: "review" }));
      },
    };
    return () => {
      tools.current = null;
    };
  });
  usePreventRemove(
    Boolean((state || busy) && !finished && !canLeave),
    confirmExit,
  );
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
  useEffect(() => {
    if (finished && attempt)
      router.replace({
        pathname: "/review",
        params: { kind: kindFromParams(params.kind), id: attempt.attemptId },
      });
  }, [finished, attempt, params.kind, router]);
  const latest = useRef({ attempt, state, exam });
  useEffect(() => {
    latest.current.exam = exam;
  }, [exam]);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const drafts = useMemo(
    () =>
      createDraftWriter({
        write: (value) => AsyncStorage.setItem(draftKey, value),
        remove: () => AsyncStorage.removeItem(draftKey),
      }),
    [draftKey],
  );
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
      const draft = drafts.write(serializeDraft(attemptId, next));
      // Observe storage failures immediately even while an older network job
      // is running; the queued save still reports the rejection to the UI.
      void draft.saved.catch(() => undefined);
      const job = saving.current
        .catch(() => undefined)
        .then(async () => {
          await draft.saved;
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
          await drafts.acknowledge(draft.version);
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
    [drafts],
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (status) => {
      const current = latest.current;
      if (
        !discarding.current &&
        !busyRef.current &&
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
    if (!exam || busyRef.current) return;
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
  const autoStarted = useRef(false);
  const startAutomatically = useEffectEvent(() => {
    void start();
  });
  useEffect(() => {
    if (params.autoStart === "true" && exam && !autoStarted.current) {
      autoStarted.current = true;
      startAutomatically();
    }
  }, [params.autoStart, exam]);
  // A ref is updated before React renders, so a second tap builds on the first
  // even while the previous full snapshot is still being persisted.
  function transition(
    update: (current: ExamEngineSnapshot) => ExamEngineSnapshot,
    expectedQuestionId?: string,
  ) {
    const current = latest.current.state;
    if (
      !current ||
      busyRef.current ||
      discarding.current ||
      current.showTimeExpiredDialog ||
      remainingSeconds(
        latest.current.attempt?.currentSegmentEndsAt ?? null,
        Date.now(),
      ) === 0
    )
      return;
    if (
      expectedQuestionId &&
      latest.current.exam?.questions[current.currentIndex]?.id !==
        expectedQuestionId
    )
      return;
    const next = update(current);
    if (next === current) return;
    latest.current.state = next;
    setState(next);
    void save(next)
      .then(() => setError(null))
      .catch(setError);
  }
  // Starting another timed section must wait for the server-owned deadline.
  async function transitionSegment(
    next: ExamEngineSnapshot,
    seconds?: number | null,
  ) {
    if (busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await save(next, seconds);
      latest.current.state = next;
      setState(next);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    const { attempt, exam, state } = latest.current;
    if (!attempt || !exam || !state || busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await save(state);
      await finishNativeExam(latest.current.attempt ?? attempt, exam, state);
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
    if (!attempt || busyRef.current) return;
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
    if (busyRef.current) return;
    const state = latest.current.state;
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
          <Loading
            variant={params.autoStart === "true" ? "question" : "detail"}
          />
        )}
        {error instanceof WebPracticeRequiredError && (
          <Action
            title="Continue on UCAT web"
            onPress={() => {
              void openWebSettings("/exam");
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
    const state = latest.current.state;
    if (!state || busyRef.current) return;
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
            latest.current.attempt = result.active;
            latest.current.state = result.active.engineSnapshot;
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
    if (next) void transitionSegment(enterSegment(state, next), next.seconds);
    else void finish();
  }
  const errorView = error ? (
    <Failure
      error={error}
      retry={
        state
          ? () => {
              void save(latest.current.state ?? state)
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
                    if (busyRef.current) return;
                    transition(
                      (current) => ({
                        ...current,
                        flaggedIds: current.flaggedIds.includes(question.id)
                          ? current.flaggedIds.filter(
                              (id) => id !== question.id,
                            )
                          : [...current.flaggedIds, question.id],
                      }),
                      question.id,
                    );
                  }
                : undefined
            }
          />
        )}
        <Stack.Screen
          options={{
            title: exam.title,
            headerBackVisible: (!state && !busy) || finished,
            gestureEnabled: (!state && !busy) || finished,
          }}
        />
        {!state && params.autoStart === "true" && !error ? (
          <Loading variant="question" />
        ) : !state ? (
          <>
            <Group>
              <Copy large>{exam.title}</Copy>
              <Copy>{exam.questions.length} questions</Copy>
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
          <Copy>Opening attempt results…</Copy>
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
                          transition((current) => ({
                            ...current,
                            phase: "question",
                            currentIndex: segment.start + i,
                          }))
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
                    if (busyRef.current) return;
                    transition(
                      (current) => ({
                        ...current,
                        responseSnapshots: {
                          ...current.responseSnapshots,
                          [question.id]: answer,
                        },
                        visitedQuestionIds: [
                          ...new Set([
                            ...current.visitedQuestionIds,
                            question.id,
                          ]),
                        ],
                      }),
                      question.id,
                    );
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
            transition((current) => ({
              ...current,
              currentIndex: Math.max(segment.start, current.currentIndex - 1),
            }))
          }
          next={() =>
            transition((current) =>
              current.currentIndex + 1 < segment.end
                ? { ...current, currentIndex: current.currentIndex + 1 }
                : { ...current, phase: "review" },
            )
          }
          hidePrevious={state.currentIndex <= segment.start}
          reviewNext={state.currentIndex + 1 >= segment.end}
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
