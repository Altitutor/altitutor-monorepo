"use client";

import { useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { UcatTableRowActionLink } from "@/features/progress/components/ucat-table-row-action-link";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { quotaPayloadFromUsage } from "@/features/ucat-access/lib/quota-payload-from-usage";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type { SetAttemptRow } from "@/features/sets/api/sets-api";
import { useSet, useSetAttempts, useSetQuestionCount } from "@/features/sets";
import {
  UCAT_NATIVE_TABLE_BODY_ROW,
  UCAT_NATIVE_TABLE_HEADER_ROW,
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_SHELL,
  ucatClickableCardClassName,
} from "@/lib/ucat-surface-motion";
import { formatExamDurationSeconds } from "@/lib/format-exam-duration";
import type { SessionResourceEntryContext } from "@/features/sessions/lib/session-resource-entry-context";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type SetDetailPageProps = {
  setId: string;
  /** When provided, back button goes to section page */
  sectionNumber?: number;
  /** Override back link (e.g. when from set generator) */
  backHref?: string;
  /** Override back label */
  backLabel?: string;
  /** Opened from `/sessions/[id]/sets/...` — back + breadcrumbs use session */
  sessionEntryContext?: SessionResourceEntryContext;
};

function buildSetDetailBreadcrumbOverrides(
  sessionEntryContext: SessionResourceEntryContext | undefined,
  leafIndex: number,
  leafLabel: string,
): Record<number, string> {
  const o: Record<number, string> = { [leafIndex]: leafLabel };
  if (sessionEntryContext != null) {
    o[1] = sessionEntryContext.breadcrumbDateLabel;
  }
  return o;
}

export function SetDetailPage({
  setId,
  sectionNumber,
  backHref: backHrefProp,
  backLabel: backLabelProp,
  sessionEntryContext,
}: SetDetailPageProps) {
  const router = useRouter();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { data: quota } = useQuotaUsage();
  const { active: activeExamAttempt } = useActiveExamAttempt();
  const {
    isLoading: questionEngineTourLoading,
    isBlocked: questionEngineTourBlocked,
  } = useQuestionEngineTutorialGate();
  const { data: set, isLoading, error } = useSet(setId);
  const { data: attempts = [] } = useSetAttempts(setId);
  const { data: questionCount } = useSetQuestionCount(setId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const attemptsHeadingId = useId();

  const setQuota = quota?.areas.find((area) => area.area === "sets") ?? null;

  const backHref =
    backHrefProp ??
    (sessionEntryContext != null
      ? `/sessions/${encodeURIComponent(sessionEntryContext.sessionId)}`
      : sectionNumber != null
        ? `/sets/sections/${sectionNumber}`
        : "/sets");
  const backLabel =
    backLabelProp ??
    (sessionEntryContext != null
      ? "Back to session"
      : sectionNumber != null
        ? "Back to section"
        : "Back to all sets");
  const breadcrumbLeafSegmentIndex =
    sessionEntryContext != null || sectionNumber != null ? 2 : 1;

  const handleLaunchSet = () => {
    if (questionEngineTourLoading) return;
    const examHref = `/exam/sets?id=${encodeURIComponent(setId)}`;
    if (questionEngineTourBlocked) {
      router.push(buildQuestionEngineTutorialHref(examHref));
      return;
    }
    const canResumeCurrentAttempt =
      activeExamAttempt?.kind === "set" &&
      activeExamAttempt.resourceId === setId;
    if (!canResumeCurrentAttempt && (setQuota?.disabled || setQuota?.atLimit)) {
      openQuotaLimit(quotaPayloadFromUsage(setQuota), {
        dismissAction: {
          label: "Dismiss",
          variant: "dismiss",
        },
      });
      return;
    }
    router.push(examHref);
  };

  if (isLoading) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildSetDetailBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            "Set",
          )}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load set"}
        </p>
      </div>
    );
  }

  if (!set) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildSetDetailBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            "Set",
          )}
        />
        <p className="text-sm text-red-600 dark:text-red-400">Set not found.</p>
      </div>
    );
  }

  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    "Question set";

  const description = extractTextFromRichJson(set.description as JsonLike);

  const infoRows: Array<[string, string]> = [
    ["Time limit", formatExamDurationSeconds(set.time_limit_seconds)],
    ["Questions", questionCount != null ? String(questionCount) : "—"],
  ];

  const setAttemptHref = (attemptId: string) =>
    sectionNumber != null
      ? `/progress/sections/${sectionNumber}/set-attempts/${attemptId}`
      : `/progress/set-attempts/${attemptId}`;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={title}
          description={
            description ?? "Review this practice set before starting."
          }
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildSetDetailBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            title,
          )}
        />
      </motion.div>

      <motion.section
        variants={itemVariants}
        className={ucatClickableCardClassName({
          interactive: false,
          className: "gap-0",
        })}
      >
        {infoRows.map(([label, value]) => (
          <div
            key={label}
            className="flex w-full items-center justify-between gap-6 py-3 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-medium">{value}</span>
          </div>
        ))}
      </motion.section>

      {attempts.length > 0 ? (
        <motion.section
          aria-labelledby={attemptsHeadingId}
          className="space-y-4"
          variants={itemVariants}
        >
          <h2
            id={attemptsHeadingId}
            className="flex items-center gap-2 text-2xl font-semibold tracking-tight"
          >
            Previous attempts
          </h2>
          <div className={UCAT_TABLE_SHELL}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] caption-bottom text-sm">
                <thead className={UCAT_TABLE_HEADER_CLASSNAME}>
                  <tr className={UCAT_NATIVE_TABLE_HEADER_ROW}>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      Score
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      Scaled
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: SetAttemptRow) => (
                    <tr key={a.id} className={UCAT_NATIVE_TABLE_BODY_ROW}>
                      <td className="p-4 align-middle">
                        {new Date(a.attemptedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {a.scorePoints != null && a.totalPoints != null
                          ? `${a.scorePoints} / ${a.totalPoints}`
                          : "—"}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {a.scaledScore != null ? a.scaledScore : "—"}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <UcatTableRowActionLink
                          href={setAttemptHref(a.id)}
                          label="View attempt"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      ) : null}

      <motion.div className="flex justify-end" variants={itemVariants}>
        <Button
          className={UCAT_PRIMARY_ACTION_BUTTON}
          onClick={handleLaunchSet}
        >
          Launch set
        </Button>
      </motion.div>
    </motion.div>
  );
}
