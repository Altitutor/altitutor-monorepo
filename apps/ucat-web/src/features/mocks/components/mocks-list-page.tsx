"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Badge, ListToolbar } from "@altitutor/ui";
import type { DataTableFilterDefinition } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import {
  useAttemptedMockIds,
  useMocks,
} from "@/features/mocks/hooks/use-mocks";
import {
  filterMocks,
  type StudentMockRow,
} from "@/features/mocks/api/mocks-api";
import { recordToMocksFilters } from "@/features/mocks/lib/filter-adapters";
import { NotebookText } from "lucide-react";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import { formatExamDurationSeconds } from "@/lib/format-exam-duration";
import {
  UCAT_LIST_ROW_LINK,
} from "@/lib/ucat-surface-motion";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

const TIMED_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: "timed", label: "Timed" },
  { value: "untimed", label: "Untimed" },
];

const SOURCE_OPTIONS: DataTableFilterDefinition["options"] = [
  { value: "my", label: "My mocks" },
  { value: "public", label: "Public mocks" },
];

const FILTER_DEFINITIONS: DataTableFilterDefinition[] = [
  { key: "timed", label: "Timing", options: TIMED_OPTIONS },
  { key: "source", label: "Source", options: SOURCE_OPTIONS },
];

export function MocksListPage() {
  const { data: mocks, isLoading, error } = useMocks();
  const { data: attemptedMockIds = new Set<string>() } = useAttemptedMockIds();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const [search, setSearch] = useState("");
  const [filtersRecord, setFiltersRecord] = useState<Record<string, unknown[]>>(
    {},
  );

  const effectiveFilters = useMemo(
    () => recordToMocksFilters(filtersRecord),
    [filtersRecord],
  );

  const filteredMocks = useMemo(() => {
    if (!mocks) return [];
    const filtered = filterMocks(mocks, {
      ...effectiveFilters,
      search: search.trim() || undefined,
    });
    return [...filtered].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [mocks, effectiveFilters, search]);

  const handleFiltersChange = useCallback(
    (filters: Record<string, unknown[]>) => {
      setFiltersRecord(filters);
    },
    [],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  if (isLoading) {
    return <AppPageSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div id="tour-mocks-page">
          <UcatPageHeader
            title="Mocks"
            description="Full-length UCAT mock exams."
          />
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load mocks"}
        </p>
      </div>
    );
  }

  if (!mocks || mocks.length === 0) {
    return (
      <div className="space-y-6">
        <div id="tour-mocks-page">
          <UcatPageHeader
            title="Mocks"
            description="Full-length UCAT mock exams."
          />
        </div>
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div id="tour-mocks-page">
        <UcatPageHeader
          title="Mocks"
          description="Choose a mock to start the exam (first set)."
        />
      </div>
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search mocks..."
          filterDefinitions={FILTER_DEFINITIONS}
          filters={filtersRecord}
          onFiltersChange={handleFiltersChange}
        />

        {filteredMocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mocks match your search or filters.
          </p>
        ) : (
          <motion.ul
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {filteredMocks.map((mock) => (
              <motion.li key={mock.id} variants={itemVariants}>
                <MockCard
                  mock={mock}
                  attemptedMockIds={attemptedMockIds}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function MockCard({
  mock,
  attemptedMockIds,
}: {
  mock: StudentMockRow;
  attemptedMockIds: Set<string>;
}) {
  const totalTimeLabel = formatExamDurationSeconds(mock.totalTimeLimitSeconds);
  const attempted = attemptedMockIds.has(mock.id);

  return (
    <Link
      href={`/mocks/${encodeURIComponent(mock.id)}`}
      className={UCAT_LIST_ROW_LINK}
    >
      <div className="rounded-lg bg-muted/60 p-2.5 transition-colors duration-200 group-hover:bg-muted">
        <NotebookText className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{mock.name ?? "Mock exam"}</p>
        {mock.set_count != null ? (
          <p className="text-xs text-muted-foreground">
            {mock.set_count} set{mock.set_count !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right text-sm text-muted-foreground">
        {attempted ? <Badge variant="secondary">Attempted</Badge> : null}
        <span className="font-medium text-foreground/80">{totalTimeLabel}</span>
      </div>
      <UcatHoverChevron />
    </Link>
  );
}
