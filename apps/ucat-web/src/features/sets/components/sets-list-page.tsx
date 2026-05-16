"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, ListToolbar, TablePagination } from "@altitutor/ui";
import type { DataTableFilterDefinition } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { useAttemptedSetIds, useSets } from "@/features/sets/hooks/use-sets";
import { filterSets, type StudentSetRow } from "@/features/sets/api/sets-api";
import {
  formatSetSections,
  SECTION_NUMBER_TO_NAME,
} from "@/features/sets/lib/section-labels";
import { recordToSetsFilters } from "@/features/sets/lib/filter-adapters";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";
import { ListChecks } from "lucide-react";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_LIST_ROW_LINK,
  UCAT_PAGINATION_ACTIVE_PAGE_BUTTON,
} from "@/lib/ucat-surface-motion";

const DEFAULT_PAGE_SIZE = 10;

const TIMED_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: "timed", label: "Timed" },
  { value: "untimed", label: "Untimed" },
];

const SOURCE_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: "my", label: "My sets" },
  { value: "public", label: "Public sets" },
];

const SECTION_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: 1, label: "Verbal Reasoning" },
  { value: 2, label: "Decision Making" },
  { value: 3, label: "Quantitative Reasoning" },
  { value: 4, label: "Situational Judgement" },
];

const ATTEMPTED_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: "unattempted", label: "Unattempted" },
];

export type SetsListPageProps = {
  /** When provided, pre-filters sets to this section and hides the section filter */
  sectionNumber?: number;
};

function formatTimeLimit(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "Untimed";
  return `${Math.round(seconds / 60)} min`;
}

export function SetsListPage({
  sectionNumber: sectionNumberProp,
}: SetsListPageProps = {}) {
  const queryClient = useQueryClient();
  const { data: sets, isLoading, error } = useSets();
  const { data: attemptedSetIds = new Set<string>() } = useAttemptedSetIds();
  const [search, setSearch] = useState("");
  const [filtersRecord, setFiltersRecord] = useState<Record<string, unknown[]>>(
    () => ({}) as Record<string, unknown[]>,
  );

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["ucat", "attempted-set-ids"] });
  }, [queryClient]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const effectiveFilters = useMemo(() => {
    const fromRecord = recordToSetsFilters(filtersRecord);
    if (sectionNumberProp != null) {
      return { ...fromRecord, sectionNumber: sectionNumberProp };
    }
    return fromRecord;
  }, [filtersRecord, sectionNumberProp]);

  const filteredSets = useMemo(() => {
    if (!sets) return [];
    return filterSets(
      sets,
      { ...effectiveFilters, search: search.trim() || undefined },
      attemptedSetIds,
      (v) => extractTextFromRichJson(v as JsonLike),
    );
  }, [sets, effectiveFilters, search, attemptedSetIds]);

  const totalPages = Math.max(1, Math.ceil(filteredSets.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedSets = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredSets.slice(start, start + pageSize);
  }, [filteredSets, currentPage, pageSize]);

  const handleFiltersChange = useCallback(
    (filters: Record<string, unknown[]>) => {
      setFiltersRecord(filters);
      setPage(0);
    },
    [],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const filterDefinitions = useMemo((): DataTableFilterDefinition[] => {
    const defs: DataTableFilterDefinition[] = [
      { key: "timed", label: "Timing", options: TIMED_OPTIONS },
      { key: "source", label: "Source", options: SOURCE_OPTIONS },
    ];
    if (sectionNumberProp == null) {
      defs.push({
        key: "sectionNumber",
        label: "Section",
        options: SECTION_OPTIONS,
      });
    } else {
      defs.push({
        key: "attempted",
        label: "Status",
        options: ATTEMPTED_OPTIONS,
      });
    }
    return defs;
  }, [sectionNumberProp]);

  const sectionTitle =
    sectionNumberProp != null
      ? (SECTION_NUMBER_TO_NAME[sectionNumberProp] ??
        `Section ${sectionNumberProp}`)
      : null;
  const pageTitle = sectionTitle ? `${sectionTitle} sets` : "Sets";
  const pageDescription = sectionTitle
    ? `Practice question sets for ${sectionTitle}.`
    : "Choose a set to start practicing.";

  const backProps =
    sectionNumberProp != null
      ? { backHref: "/sets" as const, backLabel: "Back to sets" as const }
      : {};

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title={pageTitle}
          description={pageDescription}
          {...backProps}
        />
        <p className="text-sm text-muted-foreground">Loading sets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title={pageTitle}
          description={pageDescription}
          {...backProps}
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load sets"}
        </p>
      </div>
    );
  }

  if (!sets || sets.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title={pageTitle}
          description={pageDescription}
          {...backProps}
        />
        <p className="text-sm text-muted-foreground">No sets available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={pageTitle}
        description={pageDescription}
        backHref={sectionNumberProp != null ? "/sets" : undefined}
        backLabel={sectionNumberProp != null ? "Back to sets" : undefined}
      />
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search sets..."
          filterDefinitions={filterDefinitions}
          filters={filtersRecord}
          onFiltersChange={handleFiltersChange}
        />

        <ul className="space-y-3">
          {paginatedSets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              attemptedSetIds={attemptedSetIds}
              sectionNumber={sectionNumberProp}
            />
          ))}
        </ul>

        {filteredSets.length > 0 && (
          <div className="border-t border-border pt-4 ucat-pagination">
            <TablePagination
              page={currentPage + 1}
              pageSize={pageSize}
              total={filteredSets.length}
              onPageChange={(p) => setPage(p - 1)}
              onPageSizeChange={handlePageSizeChange}
              activePageButtonClassName={UCAT_PAGINATION_ACTIVE_PAGE_BUTTON}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SetCard({
  set,
  attemptedSetIds,
  sectionNumber,
}: {
  set: StudentSetRow;
  attemptedSetIds: Set<string>;
  sectionNumber?: number;
}) {
  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    "Question set";
  const timeLabel = formatTimeLimit(set.time_limit_seconds);
  const sectionsText = formatSetSections(set.sections);
  const attempted = attemptedSetIds.has(set.id);
  const setHref =
    sectionNumber != null
      ? `/sets/sections/${sectionNumber}/${encodeURIComponent(set.id)}`
      : `/sets/${encodeURIComponent(set.id)}`;

  return (
    <li>
      <Link
        href={setHref}
        className={UCAT_LIST_ROW_LINK}
      >
        <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
          <ListChecks className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{title}</p>
          {sectionsText ? (
            <p className="text-xs text-muted-foreground truncate">
              {sectionsText}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right text-sm text-muted-foreground">
          {attempted ? <Badge variant="secondary">Attempted</Badge> : null}
          {timeLabel}
        </div>
        <UcatHoverChevron />
      </Link>
    </li>
  );
}
