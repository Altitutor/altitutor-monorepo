"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { ListChecks } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { UcatTableRowActionLink } from "@/features/progress/components/ucat-table-row-action-link";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type { SetAttemptRow } from "@/features/sets/api/sets-api";
import { useSetAttempts, useSets } from "@/features/sets";
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
  const { data: sets, isLoading, error } = useSets();
  const { data: attempts = [] } = useSetAttempts(setId);
  const attemptsHeadingId = useId();

  const set = useMemo(
    () => (sets ?? []).find((item) => item.id === setId),
    [sets, setId],
  );

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
    sessionEntryContext != null
      ? 3
      : backHrefProp != null
        ? 2
        : sectionNumber != null
          ? 3
          : 1;

  if (isLoading) {
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
        <p className="text-sm text-muted-foreground">Loading set...</p>
      </div>
    );
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

  if (!sets || sets.length === 0) {
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
        <p className="text-sm text-muted-foreground">No sets available.</p>
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

  const timeLabel =
    set.time_limit_seconds != null
      ? set.time_limit_seconds === 0
        ? "Untimed"
        : `${Math.round(set.time_limit_seconds / 60)} minute${set.time_limit_seconds / 60 === 1 ? "" : "s"}`
      : null;

  const createdAt =
    set.created_at != null
      ? new Date(set.created_at).toLocaleString(undefined, {
          dateStyle: "medium",
        })
      : null;

  const updatedAt =
    set.updated_at != null
      ? new Date(set.updated_at).toLocaleString(undefined, {
          dateStyle: "medium",
        })
      : null;

  const setAttemptHref = (attemptId: string) =>
    sectionNumber != null
      ? `/progress/sections/${sectionNumber}/set-attempts/${attemptId}`
      : `/progress/set-attempts/${attemptId}`;

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={title}
        description={description ?? "Review this practice set before starting."}
        backHref={backHref}
        backLabel={backLabel}
        breadcrumbOverrides={buildSetDetailBreadcrumbOverrides(
          sessionEntryContext,
          breadcrumbLeafSegmentIndex,
          title,
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
          <div>
            <dt className="font-medium text-muted-foreground">Time limit</dt>
            <dd>{timeLabel ?? "No time limit specified"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Type</dt>
            <dd>
              {set.is_student_generated
                ? "Generated from your performance"
                : "Standard UCAT practice set"}
            </dd>
          </div>
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
        </section>
      ) : null}

      <div className="flex justify-end">
        <Link
          href={`/exam/sets?id=${encodeURIComponent(set.id)}`}
          className={UCAT_PRIMARY_ACTION_BUTTON}
        >
          Launch set
        </Link>
      </div>
    </div>
  );
}
