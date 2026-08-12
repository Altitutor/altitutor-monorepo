import { isAttemptAtResults } from "@/features/exam-attempts/lib/banner-copy";
import type {
  ActiveExamAttempt,
  ExamAttemptKind,
} from "@/lib/ucat/exam-attempt/types";

/**
 * Server `null` means no active attempt and must win over stale local /
 * completed-notice fallbacks. `undefined` means the query has not resolved yet.
 */
export function resolveActiveExamAttemptFromSources({
  queryData,
  localActive,
  completedNotice,
}: {
  queryData: ActiveExamAttempt | null | undefined;
  localActive: ActiveExamAttempt | null;
  completedNotice: ActiveExamAttempt | null;
}): ActiveExamAttempt | null {
  if (queryData !== undefined) return queryData;
  return localActive ?? completedNotice;
}

/** Results-phase attempts are finished — they must not block launching another exam. */
export function getLaunchConflictAttempt(
  active: ActiveExamAttempt | null,
  kind: ExamAttemptKind,
  resourceId: string,
): ActiveExamAttempt | null {
  if (!active) return null;
  if (isAttemptAtResults(active)) return null;
  if (active.kind === kind && active.resourceId === resourceId) return null;
  return active;
}
