"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BrainCircuit, ListChecks, NotebookText } from "lucide-react";
import { Card, CardContent } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import {
  useStudentUcatSessionResources,
  useStudentUcatSessions,
} from "@/features/sessions/hooks/use-sessions";
import { formatSessionBreadcrumbDate } from "@/features/sessions/lib/format-session-breadcrumb-date";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import { useSets } from "@/features/sets";
import type { StudentSetRow } from "@/features/sets/api/sets-api";
import { useMocks } from "@/features/mocks";
import type { StudentMockRow } from "@/features/mocks/api/mocks-api";
import { formatSetSections } from "@/features/sets/lib/section-labels";
import { sessionCardIconChipClassName } from "@/features/sessions/lib/session-card-icon-chip";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const sessionResourceLinkClassName = cn(
  "group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
);

const sessionResourceCardClassName = cn(UCAT_CARD_CHROME, UCAT_CARD_RAISED_HOVER);

type SessionDetailPageProps = {
  sessionId: string;
};

function formatPracticeTiming(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "Untimed";
  return `${Math.round(seconds / 60)} min`;
}

function setResourceSubtitle(set: StudentSetRow): string {
  const sections = formatSetSections(set.sections);
  const timing = formatPracticeTiming(set.time_limit_seconds);
  return [sections, timing].filter(Boolean).join(" · ");
}

function mockResourceSubtitle(mock: StudentMockRow): string {
  return mock.has_timed_sets === true ? "Timed" : "Untimed";
}

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  const { data: sessions } = useStudentUcatSessions();
  const sessionBreadcrumbLabel = useMemo(() => {
    const s = sessions?.find((x) => x.session_id === sessionId);
    return formatSessionBreadcrumbDate(s?.start_at);
  }, [sessions, sessionId]);
  const sessionBreadcrumbOverrides = { 1: sessionBreadcrumbLabel };

  const {
    data: resources,
    isLoading,
    error,
  } = useStudentUcatSessionResources(sessionId);
  const { data: sets, isLoading: setsLoading } = useSets();
  const { data: mocks, isLoading: mocksLoading } = useMocks();

  const setsById = useMemo(
    () => new Map((sets ?? []).map((s) => [s.id, s])),
    [sets],
  );
  const mocksById = useMemo(
    () => new Map((mocks ?? []).map((m) => [m.id, m])),
    [mocks],
  );

  const needsSetsCatalog = useMemo(
    () => resources?.some((r) => r.type === "set") ?? false,
    [resources],
  );
  const needsMocksCatalog = useMemo(
    () => resources?.some((r) => r.type === "mock") ?? false,
    [resources],
  );
  const catalogBlocking =
    !!resources &&
    resources.length > 0 &&
    ((needsSetsCatalog && setsLoading) || (needsMocksCatalog && mocksLoading));

  const visibleResources = useMemo(() => {
    if (!resources?.length) return [];
    return resources.filter((r) => {
      if (r.type === "stem") return true;
      if (r.type === "set") {
        if (setsLoading) return false;
        return setsById.has(r.question_set_id);
      }
      if (r.type === "mock") {
        if (mocksLoading) return false;
        return mocksById.has(r.ucat_mock_id);
      }
      return false;
    });
  }, [resources, setsLoading, mocksLoading, setsById, mocksById]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Resources linked to this session."
          backHref="/sessions"
          backLabel="Back to sessions"
          breadcrumbOverrides={sessionBreadcrumbOverrides}
        />
        <p className="text-sm text-muted-foreground">
          Loading session resources...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Resources linked to this session."
          backHref="/sessions"
          backLabel="Back to sessions"
          breadcrumbOverrides={sessionBreadcrumbOverrides}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error
            ? error.message
            : "Failed to load session resources"}
        </p>
      </div>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Resources linked to this session."
          backHref="/sessions"
          backLabel="Back to sessions"
          breadcrumbOverrides={sessionBreadcrumbOverrides}
        />
        <p className="text-sm text-muted-foreground">
          No UCAT resources have been attached to this session yet.
        </p>
      </div>
    );
  }

  if (catalogBlocking) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Launch the resources linked to this class session."
          backHref="/sessions"
          backLabel="Back to sessions"
          breadcrumbOverrides={sessionBreadcrumbOverrides}
        />
        <p className="text-sm text-muted-foreground">
          Loading linked sets and mocks...
        </p>
      </div>
    );
  }

  if (visibleResources.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Launch the resources linked to this class session."
          backHref="/sessions"
          backLabel="Back to sessions"
          breadcrumbOverrides={sessionBreadcrumbOverrides}
        />
        <p className="text-sm text-muted-foreground">
          None of the linked sets or mocks are available in your account right
          now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Session resources"
        description="Launch the resources linked to this class session."
        backHref="/sessions"
        backLabel="Back to sessions"
        breadcrumbOverrides={sessionBreadcrumbOverrides}
      />

      <ul className="flex flex-col gap-4">
        {visibleResources.map((resource) => {
          if (resource.type === "stem") {
            const href = `/practice/stem/${encodeURIComponent(resource.question_stem_id)}`;
            return (
              <li key={resource.id} className="min-w-0">
                <Link href={href} className={sessionResourceLinkClassName}>
                  <Card className={sessionResourceCardClassName}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={sessionCardIconChipClassName("default")}
                        >
                          <BrainCircuit className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-semibold leading-tight">
                            Question stem
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Practice questions for this stem
                          </p>
                        </div>
                        <UcatHoverChevron />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          }

          if (resource.type === "set") {
            const set = setsById.get(resource.question_set_id)!;
            const title =
              extractTextFromRichJson(set.name as JsonLike) ||
              extractTextFromRichJson(set.description as JsonLike) ||
              "Practice set";
            const subtitle = setResourceSubtitle(set);
            const href = `/sessions/${encodeURIComponent(sessionId)}/sets/${encodeURIComponent(resource.question_set_id)}`;

            return (
              <li key={resource.id} className="min-w-0">
                <Link href={href} className={sessionResourceLinkClassName}>
                  <Card className={sessionResourceCardClassName}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={sessionCardIconChipClassName("default")}
                        >
                          <ListChecks className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="truncate font-semibold leading-tight">
                            {title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {subtitle}
                          </p>
                        </div>
                        <UcatHoverChevron />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          }

          const mock = mocksById.get(resource.ucat_mock_id)!;
          const title = mock.name ?? "Mock exam";
          const subtitle = mockResourceSubtitle(mock);
          const href = `/sessions/${encodeURIComponent(sessionId)}/mocks/${encodeURIComponent(resource.ucat_mock_id)}`;

          return (
            <li key={resource.id} className="min-w-0">
              <Link href={href} className={sessionResourceLinkClassName}>
                <Card className={sessionResourceCardClassName}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={sessionCardIconChipClassName("default")}
                      >
                        <NotebookText className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate font-semibold leading-tight">
                          {title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {subtitle}
                        </p>
                      </div>
                      <UcatHoverChevron />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
