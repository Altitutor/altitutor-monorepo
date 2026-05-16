"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { NotebookText } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import type {
  MockAttemptSectionScore,
  MockAttemptWithBreakdown,
} from "@/features/mocks/api/mocks-api";
import { useMockAttemptsWithBreakdown, useMocks } from "@/features/mocks";
import {
  UCAT_NATIVE_TABLE_BODY_ROW,
  UCAT_NATIVE_TABLE_HEADER_ROW,
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { SessionResourceEntryContext } from "@/features/sessions/lib/session-resource-entry-context";

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
  const { data: mocks, isLoading, error } = useMocks();
  const { data: attempts = [] } = useMockAttemptsWithBreakdown(mockId);
  const attemptsHeadingId = useId();

  const breadcrumbLeafSegmentIndex = sessionEntryContext != null ? 3 : 1;
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

  if (isLoading) {
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
        <p className="text-sm text-muted-foreground">Loading mock...</p>
      </div>
    );
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

  const createdAt =
    mock.created_at != null
      ? new Date(mock.created_at).toLocaleString(undefined, {
          dateStyle: "medium",
        })
      : null;

  const updatedAt =
    mock.updated_at != null
      ? new Date(mock.updated_at).toLocaleString(undefined, {
          dateStyle: "medium",
        })
      : null;

  const sectionColumns =
    attempts.length > 0 && attempts[0].sectionScores.length > 0
      ? attempts[0].sectionScores
      : [];

  return (
    <div className="space-y-6">
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

      <section
        className={cn(
          "space-y-2 rounded-ucatShell p-4 text-card-foreground",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {createdAt ? (
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd>{createdAt}</dd>
            </div>
          ) : null}
          {updatedAt ? (
            <div>
              <dt className="font-medium text-muted-foreground">
                Last updated
              </dt>
              <dd>{updatedAt}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {attempts.length > 0 ? (
        <section
          aria-labelledby={attemptsHeadingId}
          className="space-y-4"
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
        </section>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={`/exam/mocks?id=${encodeURIComponent(mock.id)}`}
          className={UCAT_PRIMARY_ACTION_BUTTON}
        >
          Launch mock
        </Link>
      </div>
    </div>
  );
}
