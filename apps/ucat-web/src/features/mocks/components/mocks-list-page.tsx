"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, ListToolbar, TablePagination } from "@altitutor/ui";
import type { DataTableFilterDefinition } from "@altitutor/shared";
import { UcatPageHeader } from "@/features/layout";
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
  const [search, setSearch] = useState("");
  const [filtersRecord, setFiltersRecord] = useState<Record<string, unknown[]>>(
    {},
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const effectiveFilters = useMemo(
    () => recordToMocksFilters(filtersRecord),
    [filtersRecord],
  );

  const filteredMocks = useMemo(() => {
    if (!mocks) return [];
    return filterMocks(mocks, {
      ...effectiveFilters,
      search: search.trim() || undefined,
    });
  }, [mocks, effectiveFilters, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMocks.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedMocks = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredMocks.slice(start, start + pageSize);
  }, [filteredMocks, currentPage, pageSize]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mocks"
          description="Full-length UCAT mock exams."
        />
        <p className="text-sm text-muted-foreground">Loading mocks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mocks"
          description="Full-length UCAT mock exams."
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Failed to load mocks"}
        </p>
      </div>
    );
  }

  if (!mocks || mocks.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mocks"
          description="Full-length UCAT mock exams."
        />
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Mocks"
        description="Choose a mock to start the exam (first set)."
      />
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search mocks..."
          filterDefinitions={FILTER_DEFINITIONS}
          filters={filtersRecord}
          onFiltersChange={handleFiltersChange}
        />

        <ul className="space-y-3">
          {paginatedMocks.map((mock) => (
            <MockCard
              key={mock.id}
              mock={mock}
              attemptedMockIds={attemptedMockIds}
            />
          ))}
        </ul>

        {filteredMocks.length > 0 && (
          <div className="border-t border-border pt-4 ucat-pagination">
            <TablePagination
              page={currentPage + 1}
              pageSize={pageSize}
              total={filteredMocks.length}
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

function MockCard({
  mock,
  attemptedMockIds,
}: {
  mock: StudentMockRow;
  attemptedMockIds: Set<string>;
}) {
  const timeLabel = mock.has_timed_sets ? "Timed" : "Untimed";
  const attempted = attemptedMockIds.has(mock.id);

  return (
    <li>
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
          {timeLabel}
        </div>
        <UcatHoverChevron />
      </Link>
    </li>
  );
}
