import type {
  MockTimingSegment,
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";

export function getCurrentSegmentTimeLimitSeconds(
  exam: QuestionEngineExam,
  state: QuestionEngineState,
): number | null {
  if (exam.sourceType === "set" && exam.setModeTiming) {
    const t = exam.setModeTiming;
    if (t.setTimeLimitSeconds == null || t.setTimeLimitSeconds <= 0) return null;
    if (state.phase === "instructions") return t.instructionsTimeLimitSeconds;
    if (state.phase === "question" || state.phase === "review") {
      return t.setTimeLimitSeconds;
    }
    return null;
  }

  if (exam.sourceType === "mock" && exam.mockTimingSegments?.length) {
    if (state.phase === "review") {
      const setIndex = state.mockCurrentSetIndex ?? 0;
      const seg = exam.mockTimingSegments.find(
        (s) => s.type === "questions" && s.setIndex === setIndex,
      );
      return seg?.type === "questions" ? (seg.timeLimitSeconds ?? null) : null;
    }
    const seg = getCurrentMockSegment(exam, state);
    return seg?.timeLimitSeconds ?? null;
  }

  if (
    (exam.sourceType === "questions" || exam.sourceType === "questionStem") &&
    state.phase === "question" &&
    exam.timePerQuestionSeconds != null &&
    exam.timePerQuestionSeconds > 0
  ) {
    const perQuestion = exam.timePerQuestionSeconds;
    if (exam.sourceType === "questions") return perQuestion;
    const questions = exam.questions;
    const currentQ = questions[state.currentIndex];
    if (!currentQ) return perQuestion;
    const stemId = currentQ.stemId;
    let count = 0;
    for (const q of questions) {
      if (q.stemId === stemId) count += 1;
    }
    return perQuestion * Math.max(1, count);
  }

  return null;
}

export function getCurrentMockSegment(
  exam: QuestionEngineExam,
  state: QuestionEngineState,
): (MockTimingSegment & { segmentIndex: number }) | null {
  const segments = exam.mockTimingSegments;
  if (!segments?.length) return null;

  if (state.phase === "instructions") {
    const idx = segments.findIndex(
      (s) =>
        s.type === "instructions" &&
        s.instructionsIndex === state.instructionsIndex,
    );
    if (idx >= 0) {
      const s = segments[idx];
      return s.type === "instructions" ? { ...s, segmentIndex: idx } : null;
    }
    return null;
  }

  if (state.phase === "question") {
    const idx = segments.findIndex(
      (s) =>
        s.type === "questions" &&
        state.currentIndex >= s.questionStartIndex &&
        state.currentIndex < s.questionEndIndex,
    );
    if (idx >= 0) {
      const s = segments[idx];
      return s.type === "questions" ? { ...s, segmentIndex: idx } : null;
    }
  }

  return null;
}

export function getNextMockSegment(
  exam: QuestionEngineExam,
  state: QuestionEngineState,
): (MockTimingSegment & { segmentIndex: number }) | null {
  const current = getCurrentMockSegment(exam, state);
  const segments = exam.mockTimingSegments;
  if (!current || !segments || current.segmentIndex >= segments.length - 1) {
    return null;
  }
  const next = segments[current.segmentIndex + 1];
  return { ...next, segmentIndex: current.segmentIndex + 1 };
}

export function getNextSetSegmentFromReview(
  exam: QuestionEngineExam,
  mockCurrentSetIndex: number,
): (MockTimingSegment & { segmentIndex: number }) | null {
  const segments = exam.mockTimingSegments;
  if (!segments?.length) return null;
  const nextSetIndex = mockCurrentSetIndex + 1;
  const questionsSegIdx = segments.findIndex(
    (s) => s.type === "questions" && s.setIndex === nextSetIndex,
  );
  if (questionsSegIdx < 0) return null;
  const prevSeg = segments[questionsSegIdx - 1];
  if (prevSeg?.type === "instructions") {
    return { ...prevSeg, segmentIndex: questionsSegIdx - 1 };
  }
  return { ...segments[questionsSegIdx], segmentIndex: questionsSegIdx };
}

export function getRemainingSecondsFromEndsAt(
  endsAt: string,
  now = Date.now(),
): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function computeSegmentEndsAt(
  timeLimitSeconds: number | null,
  now = Date.now(),
): string | null {
  if (timeLimitSeconds == null || timeLimitSeconds <= 0) return null;
  return new Date(now + timeLimitSeconds * 1000).toISOString();
}
