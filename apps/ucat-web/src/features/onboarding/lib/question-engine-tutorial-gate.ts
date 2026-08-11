import {
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-catalog";

export type QuestionEngineTutorialKind = "full" | "controls" | "choose";

export function getQuestionEngineTutorialKind(
  familiarity: string | null | undefined,
): QuestionEngineTutorialKind {
  if (familiarity === "new") return "full";
  if (familiarity === "familiar" || familiarity === "experienced") {
    return "controls";
  }
  return "choose";
}

export function isQuestionEngineTutorialSatisfied(
  kind: QuestionEngineTutorialKind,
  isCompleted: (tourId: string) => boolean,
): boolean {
  const fullCompleted = isCompleted(UCAT_QUESTION_ENGINE_TOUR);
  if (kind === "full") return fullCompleted;

  const controlsCompleted = isCompleted(UCAT_QUESTION_ENGINE_CONTROLS_TOUR);
  return fullCompleted || controlsCompleted;
}

export function buildQuestionEngineTutorialHref(
  returnTo: string,
  kind: QuestionEngineTutorialKind = "full",
): string {
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/dashboard";
  const pathname =
    kind === "controls"
      ? "/exam/controls-tutorial"
      : kind === "choose"
        ? "/question-interface/tutorial"
        : "/exam/tutorial";
  return `${pathname}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function isQuestionEngineTutorialPath(pathname: string): boolean {
  return pathname === "/exam/tutorial" || pathname === "/exam/controls-tutorial";
}

export function isQuestionEnginePath(pathname: string): boolean {
  return (
    pathname === "/exam" ||
    /^\/sessions\/[^/]+\/(sets|mocks)\/[^/]+$/.test(pathname)
  );
}
