"use client";

import { useEffect, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import type {
  MockAttemptSectionScore,
  MockAttemptWithBreakdown,
} from "@/features/mocks/api/mocks-api";
import {
  useMockAttemptsWithBreakdown,
  useMockQuestionCount,
  useMocks,
} from "@/features/mocks";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import {
  buildQuestionEngineTutorialHref,
  useQuestionEngineTutorialGate,
} from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { quotaPayloadFromUsage } from "@/features/ucat-access/lib/quota-payload-from-usage";
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
import { getQuestionEngineExam } from "@/features/question-engine/api/question-engine-api";

type MockDetailPageProps = {
  mockId: string;
  backHref?: string;
  backLabel?: string;
  sessionEntryContext?: SessionResourceEntryContext;
};

function buildMockBreadcrumbOverrides(
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

export function MockDetailPage({
  mockId,
  backHref: backHrefProp,
  backLabel: backLabelProp,
  sessionEntryContext,
}: MockDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { data: quota } = useQuotaUsage();
  const { active: activeExamAttempt } = useActiveExamAttempt();
  const {
    isLoading: questionEngineTourLoading,
    isBlocked: questionEngineTourBlocked,
  } = useQuestionEngineTutorialGate();
  const { data: mocks, isLoading, error } = useMocks();
  const { data: attempts = [] } = useMockAttemptsWithBreakdown(mockId);
  const { data: questionCount } = useMockQuestionCount(mockId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const attemptsHeadingId = useId();
  const mockQuota = quota?.areas.find((area) => area.area === "mocks") ?? null;
  const examHref = `/exam/mocks?id=${encodeURIComponent(mockId)}`;

  const breadcrumbLeafSegmentIndex = sessionEntryContext != null ? 2 : 1;
  const backHref =
    backHrefProp ??
    (sessionEntryContext != null
      ? `/sessions/${encodeURIComponent(sessionEntryContext.sessionId)}`
      : "/mocks");
  const backLabel =
    backLabelProp ??
    (sessionEntryContext != null ? "Back to session" : "Back to all mocks");

  const mock = useMemo(
    () => (mocks ?? []).find((item) => item.id === mockId),
    [mocks, mockId],
  );

  useEffect(() => {
    if (!mock) return;
    router.prefetch(examHref);
    void queryClient.prefetchQuery({
      queryKey: ["question-engine", "mock", null, mockId],
      queryFn: () => getQuestionEngineExam({ mode: "mock", mockId }),
      staleTime: 10 * 60 * 1000,
    });
  }, [examHref, mock, mockId, queryClient, router]);

  if (isLoading) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildMockBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            "Mock",
          )}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load mock"}
        </p>
      </div>
    );
  }

  if (!mocks || mocks.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildMockBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            "Mock",
          )}
        />
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </div>
    );
  }

  if (!mock) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildMockBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            "Mock",
          )}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          Mock not found.
        </p>
      </div>
    );
  }

  const sectionColumns =
    attempts.length > 0 && attempts[0].sectionScores.length > 0
      ? attempts[0].sectionScores
      : [];

  const handleLaunchMock = () => {
    if (questionEngineTourLoading) return;
    if (questionEngineTourBlocked) {
      router.push(buildQuestionEngineTutorialHref(examHref));
      return;
    }
    const canResumeCurrentAttempt =
      activeExamAttempt?.kind === "mock" &&
      activeExamAttempt.resourceId === mockId;
    if (
      !canResumeCurrentAttempt &&
      (mockQuota?.disabled || mockQuota?.atLimit)
    ) {
      openQuotaLimit(quotaPayloadFromUsage(mockQuota), {
        dismissAction: {
          label: "Dismiss",
          variant: "dismiss",
        },
      });
      return;
    }
    router.push(examHref);
  };

  const infoRows: Array<[string, string]> = [
    [
      "Sections",
      mock.set_count != null
        ? `${mock.set_count} set${mock.set_count === 1 ? "" : "s"}`
        : "—",
    ],
    ["Total time", formatExamDurationSeconds(mock.totalTimeLimitSeconds)],
    ["Questions", questionCount != null ? String(questionCount) : "—"],
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title={mock.name ?? "Mock exam"}
          description="This mock exam will launch the full UCAT question engine using all sets included in this mock."
          backHref={backHref}
          backLabel={backLabel}
          breadcrumbOverrides={buildMockBreadcrumbOverrides(
            sessionEntryContext,
            breadcrumbLeafSegmentIndex,
            mock.name ?? "Mock",
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
        {infoRows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex w-full items-center justify-between gap-6">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-right text-sm font-medium">{value}</span>
            </div>
            {label === "Total time" && mock.setTimings.length > 0
              ? mock.setTimings.map((set) => (
                  <div
                    key={set.id}
                    className="mt-2 flex w-full items-center justify-between gap-6 pl-4"
                  >
                    <span className="text-sm text-muted-foreground">
                      {set.name}
                    </span>
                    <span className="text-right text-sm font-medium tabular-nums">
                      {formatExamDurationSeconds(set.timeLimitSeconds)}
                    </span>
                  </div>
                ))
              : null}
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
              <table className="w-full min-w-[400px] caption-bottom text-sm">
                <thead className={UCAT_TABLE_HEADER_CLASSNAME}>
                  <tr className={UCAT_NATIVE_TABLE_HEADER_ROW}>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Date
                    </th>
                    {sectionColumns.map((sec: MockAttemptSectionScore) => (
                      <th
                        key={sec.sectionNumber}
                        className="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
                      >
                        {sec.sectionName}
                      </th>
                    ))}
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      Score
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                      Scaled
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: MockAttemptWithBreakdown) => (
                    <tr key={a.id} className={UCAT_NATIVE_TABLE_BODY_ROW}>
                      <td className="p-4 align-middle">
                        {new Date(a.attemptedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      {a.sectionScores.map((sec: MockAttemptSectionScore) => (
                        <td
                          key={sec.sectionNumber}
                          className="p-4 align-middle text-right"
                        >
                          {sec.scorePoints != null && sec.totalPoints != null
                            ? `${sec.scorePoints}/${sec.totalPoints}`
                            : "—"}
                        </td>
                      ))}
                      <td className="p-4 align-middle text-right">
                        {a.scorePoints != null && a.totalPoints != null
                          ? `${a.scorePoints} / ${a.totalPoints}`
                          : "—"}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {a.scaledScore != null && a.scaledScoreMax != null
                          ? `${Math.round(a.scaledScore)} / ${a.scaledScoreMax}`
                          : a.scaledScore != null
                            ? String(Math.round(a.scaledScore))
                            : "—"}
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
          onClick={handleLaunchMock}
        >
          Launch mock
        </Button>
      </motion.div>
    </motion.div>
  );
}
