import {
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-catalog";

export type QuestionEngineTutorialKind = "full" | "controls" | "choose";

export function getQuestionEngineTutorialKind(
  familiarity: string | null | undefined,
): QuestionEngineTutorialKind {
  if (familiarity === "new" || familiarity === "familiar") return "full";
  if (familiarity === "experienced") return "controls";
  return "choose";
}

/** Either walkthrough counts so existing completions are not shown again. */
export function isQuestionEngineTutorialSatisfied(
  isCompleted: (tourId: string) => boolean,
): boolean {
  return (
    isCompleted(UCAT_QUESTION_ENGINE_TOUR) ||
    isCompleted(UCAT_QUESTION_ENGINE_CONTROLS_TOUR)
  );
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
  return (
    pathname === "/exam/tutorial" || pathname === "/exam/controls-tutorial"
  );
}

export function isQuestionEnginePath(pathname: string): boolean {
  return (
    pathname === "/exam" ||
    /^\/sessions\/[^/]+\/(sets|mocks)\/[^/]+$/.test(pathname)
  );
}
