import type {
  ActiveExamAttempt,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

export function isAttemptAtResults(active: ActiveExamAttempt): boolean {
  const { phase } = active.engineSnapshot;
  switch (active.kind) {
    case "set":
      return phase === "marking";
    case "mock":
      return phase === "mockScore";
    case "practice":
      return phase === "practiceComplete";
    default: {
      const _exhaustive: never = active.kind;
      return _exhaustive;
    }
  }
}

function kindNoun(kind: ExamAttemptKind): string {
  switch (kind) {
    case "set":
      return "Set";
    case "mock":
      return "Mock";
    case "practice":
      return "Practice session";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function attemptBannerStatusLabel(active: ActiveExamAttempt): string {
  const noun = kindNoun(active.kind);
  return isAttemptAtResults(active)
    ? `${noun} complete`
    : `${noun} in progress`;
}
