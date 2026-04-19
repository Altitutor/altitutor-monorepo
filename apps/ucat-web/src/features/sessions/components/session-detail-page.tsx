"use client";

import Link from "next/link";
import { BrainCircuit, ListChecks, NotebookText } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { useStudentUcatSessionResources } from "@/features/sessions/hooks/use-sessions";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import { useSets } from "@/features/sets";
import { useMocks } from "@/features/mocks";

type SessionDetailPageProps = {
  sessionId: string;
};

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  const {
    data: resources,
    isLoading,
    error,
  } = useStudentUcatSessionResources(sessionId);
  const { data: sets } = useSets();
  const { data: mocks } = useMocks();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Session resources"
          description="Resources linked to this session."
          backHref="/sessions"
          backLabel="Back to sessions"
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
        />
        <p className="text-sm text-muted-foreground">
          No UCAT resources have been attached to this session yet.
        </p>
      </div>
    );
  }

  const setsById = new Map((sets ?? []).map((s) => [s.id, s]));
  const mocksById = new Map((mocks ?? []).map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Session resources"
        description="Launch the resources linked to this class session."
        backHref="/sessions"
        backLabel="Back to sessions"
      />

      <ul className="space-y-2">
        {resources.map((resource) => {
          if (resource.type === "stem") {
            const href = `/practice/stem/${encodeURIComponent(resource.question_stem_id)}`;
            return (
              <li key={resource.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg bg-card text-card-foreground p-3 shadow-sm transition-colors hover:bg-muted border border-border"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      Question stem
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Practice questions for this stem
                    </p>
                  </div>
                </Link>
              </li>
            );
          }

          if (resource.type === "set") {
            const set = setsById.get(resource.question_set_id);
            const title =
              (set &&
                (extractTextFromRichJson(set.name as JsonLike) ||
                  extractTextFromRichJson(set.description as JsonLike))) ||
              "Practice set";
            const href = `/sets/${encodeURIComponent(resource.question_set_id)}`;

            return (
              <li key={resource.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg bg-card text-card-foreground p-3 shadow-sm transition-colors hover:bg-muted border border-border"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                    <ListChecks className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      Launch UCAT practice set
                    </p>
                  </div>
                </Link>
              </li>
            );
          }

          const mock = mocksById.get(resource.ucat_mock_id);
          const title = mock?.name ?? "Mock exam";
          const href = `/mocks/${encodeURIComponent(resource.ucat_mock_id)}`;

          return (
            <li key={resource.id}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-lg bg-card text-card-foreground p-3 shadow-sm transition-colors hover:bg-muted border border-border"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                  <NotebookText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    Launch full UCAT mock exam
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
