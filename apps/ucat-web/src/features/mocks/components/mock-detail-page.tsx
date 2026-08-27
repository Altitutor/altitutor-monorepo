"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
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
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import { useExamAttemptLaunchPreflight } from "@/features/exam-attempts/hooks/use-exam-attempt-launch-preflight";
import { useBeginExamRoute } from "@/features/exam-attempts/hooks/use-begin-exam-route";
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

const RECENT_ATTEMPTS_LIMIT = 5;

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

function formatMockAttemptScore(attempt: MockAttemptWithBreakdown): string {
  if (attempt.scorePoints != null && attempt.totalPoints != null) {
    return `${attempt.scorePoints} / ${attempt.totalPoints}`;
  }
  return "—";
}

function formatMockScaledScore(attempt: MockAttemptWithBreakdown): string {
  if (attempt.scaledScore != null && attempt.scaledScoreMax != null) {
    return `${Math.round(attempt.scaledScore)} / ${attempt.scaledScoreMax}`;
  }
  if (attempt.scaledScore != null) {
    return String(Math.round(attempt.scaledScore));
  }
  return "—";
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
    tutorialKind: questionEngineTutorialKind,
  } = useQuestionEngineTutorialGate();
  const { data: mocks, isLoading, error } = useMocks();
  const { data: attempts = [] } = useMockAttemptsWithBreakdown(mockId);
  const { data: questionCount } = useMockQuestionCount(mockId);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const attemptsHeadingId = useId();
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const mockQuota = quota?.areas.find((area) => area.area === "mocks") ?? null;
  const examHref = "/exam";

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
  const launchMock = useBeginExamRoute({
    kind: "mock",
    resourceId: mockId,
    title: mock?.name ?? "Mock exam",
    exitHref: backHref,
  });
  const launchPreflight = useExamAttemptLaunchPreflight({
    kind: "mock",
    resourceId: mockId,
    onLaunch: launchMock,
  });

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
      router.push(
        buildQuestionEngineTutorialHref(
          `${window.location.pathname}${window.location.search}`,
          questionEngineTutorialKind,
        ),
      );
      return;
    }
    const canResumeCurrentAttempt =
      activeExamAttempt?.kind === "mock" &&
      activeExamAttempt.resourceId === mockId;
    if (
      sessionEntryContext == null &&
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
    launchPreflight.requestLaunch();
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

  const visibleAttempts = showAllAttempts
    ? attempts
    : attempts.slice(0, RECENT_ATTEMPTS_LIMIT);
  const hasMoreAttempts = attempts.length > RECENT_ATTEMPTS_LIMIT;
  const mockAttemptHref = (attemptId: string) =>
    `/progress/mocks/mock-attempts/${attemptId}`;

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
          description="This mock opens the full UCAT-style exam interface using all the sets included in it."
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
        data-tour="mock-structure"
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

      <motion.div
        variants={itemVariants}
        className="mt-4 flex min-h-10 items-center justify-end"
      >
        <Button
          data-tour="mock-start"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          onClick={handleLaunchMock}
        >
          Launch mock
        </Button>
      </motion.div>

      {attempts.length > 0 ? (
        <section aria-labelledby={attemptsHeadingId} className="space-y-4">
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
                  {visibleAttempts.map((a: MockAttemptWithBreakdown) => (
                    <tr key={a.id} className={UCAT_NATIVE_TABLE_BODY_ROW}>
                      <td className="p-4 align-middle">
                        <Link
                          href={mockAttemptHref(a.id)}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {new Date(a.attemptedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Link>
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
                        {formatMockAttemptScore(a)}
                      </td>
                      <td className="p-4 align-middle text-right">
                        {formatMockScaledScore(a)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {hasMoreAttempts ? (
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAllAttempts((prev) => !prev)}
            >
              {showAllAttempts
                ? "Show fewer attempts"
                : `Show all ${attempts.length} attempts`}
            </Button>
          ) : null}
        </section>
      ) : null}

      <ExamAttemptConflictDialog
        open={launchPreflight.conflictActive != null}
        active={launchPreflight.conflictActive}
        pendingLabel="this mock exam"
        isDiscarding={launchPreflight.isDiscarding}
        onDiscardAndContinue={() =>
          void launchPreflight.discardConflictAndLaunch()
        }
        onCancel={launchPreflight.cancelConflict}
      />
    </motion.div>
  );
}
