"use client";

import { useMemo, useState } from "react";
import { Button, DataTableToolbar, TableCell, TableRow } from "@altitutor/ui";
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
} from "@altitutor/shared";
import type { Json } from "@altitutor/shared";
import { ReconciliationTable } from "./ReconciliationTable";
import { getQuestionIssueDefinition } from "../lib/question-issue-definitions";
import {
  duplicateComparisonMatchLabel,
  duplicateRecommendationLabel,
} from "../lib/duplicate-queue-match";
import { PotentialDuplicatesReconciliationDialog } from "./PotentialDuplicatesReconciliationDialog";
import type { PotentialDuplicatePair } from "../api/reconciliation";
import { useExactDuplicateStemsQueue } from "../hooks/useReconciliation";
import { useUcatSections } from "@/features/ucat/questions/hooks/useUcatQuestions";
import { proseMirrorToPlainText } from "@/features/ucat/shared/lib/rich-text";
import { useUcatTableUrlState } from "@/features/ucat/shared/hooks/useUcatTableUrlState";
import { cn } from "@/shared/utils";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorTableBodyRow,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";

const ISSUE = getQuestionIssueDefinition("duplicates");
const TRUNCATE_LEN = 72;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "…";
}

function stemPlain(pair: PotentialDuplicatePair, side: "A" | "B"): string {
  const stem = side === "A" ? pair.stemA : pair.stemB;
  return proseMirrorToPlainText(stem.stemText as Json) ?? "";
}

export function PotentialDuplicatesTable({
  showCountBadge = true,
}: {
  showCountBadge?: boolean
}) {
  const sectionsQuery = useUcatSections();
  const [queueOpen, setQueueOpen] = useState(false);
  const [initialPairId, setInitialPairId] = useState<string | null>(null);

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: "section", label: "Section", visibleByDefault: true },
    { key: "stem_a", label: "Stem A", visibleByDefault: true },
    { key: "stem_b", label: "Stem B", visibleByDefault: true },
    { key: "match", label: "Match", visibleByDefault: true },
    {
      key: "recommendation",
      label: "Suggested action",
      visibleByDefault: true,
    },
  ];

  const tableState = useUcatTableUrlState(
    columnDefinitions
      .filter((c) => c.visibleByDefault !== false)
      .map((c) => c.key),
    {
      paramPrefix: "potentialDuplicates",
      availableColumns: columnDefinitions.map((c) => c.key),
    },
  );
  const sectionIds = (tableState.state.filters.section_id ?? [])
    .map(String)
    .filter((value) => value && value !== "all");
  const { data, isLoading } = useExactDuplicateStemsQueue({
    search: tableState.state.search,
    sectionIds,
    page: tableState.state.page,
    pageSize: tableState.state.pageSize,
  });

  const sectionFilterDef: DataTableFilterDefinition = useMemo(
    () => ({
      key: "section_id",
      label: "Section",
      options: (sectionsQuery.data ?? []).map((s) => ({
        label: s.name ?? "Untitled",
        value: s.id ?? "",
      })),
    }),
    [sectionsQuery.data],
  );

  const filteredPairs = data?.items ?? [];

  function openQueue(pairId?: string) {
    setInitialPairId(pairId ?? null);
    setQueueOpen(true);
  }

  return (
    <>
      <ReconciliationTable<PotentialDuplicatePair>
        title={ISSUE.title}
        description={ISSUE.description}
        showCountBadge={showCountBadge}
        items={filteredPairs}
        isLoading={isLoading}
        pagination={{
          page: tableState.state.page,
          pageSize: tableState.state.pageSize,
          total: data?.total ?? 0,
          onPageChange: tableState.actions.onPageChange,
          onPageSizeChange: tableState.actions.onPageSizeChange,
        }}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={tableState.state.visibleColumns}
        toolbar={
          <DataTableToolbar
            {...tutorToolbarProps}
            state={tableState.state}
            onSearchChange={tableState.actions.onSearchChange}
            onFiltersChange={tableState.actions.onFiltersChange}
            onSortChange={tableState.actions.onSortChange}
            onGroupByChange={tableState.actions.onGroupByChange}
            onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
            onQuickFilterApply={tableState.actions.onQuickFilterApply}
            onReset={tableState.actions.onReset}
            searchPlaceholder="Search duplicate pairs..."
            filterDefinitions={[sectionFilterDef]}
            columnDefinitions={columnDefinitions}
          />
        }
        headerActions={
          <Button
            size="sm"
            className={tutorBtnPrimary}
            onClick={() => openQueue()}
            disabled={filteredPairs.length === 0}
          >
            Begin reconciling
          </Button>
        }
        renderRow={(item, _index, visibleColumnKeys) => (
          <PotentialDuplicateRow
            key={item.id}
            item={item}
            visibleColumnKeys={visibleColumnKeys}
            onCompare={() => openQueue(item.id)}
          />
        )}
      />
      <PotentialDuplicatesReconciliationDialog
        open={queueOpen}
        pairs={filteredPairs}
        initialPairId={initialPairId}
        onOpenChange={(nextOpen) => {
          setQueueOpen(nextOpen);
          if (!nextOpen) setInitialPairId(null);
        }}
      />
    </>
  );
}

function PotentialDuplicateRow({
  item,
  visibleColumnKeys,
  onCompare,
}: {
  item: PotentialDuplicatePair;
  visibleColumnKeys: string[];
  onCompare: () => void;
}) {
  const stemA = truncate(stemPlain(item, "A"), TRUNCATE_LEN);
  const stemB = truncate(stemPlain(item, "B"), TRUNCATE_LEN);
  const cells: Record<string, React.ReactNode> = {
    section: (
      <TableCell className="whitespace-nowrap">
        {item.sectionName || "-"}
      </TableCell>
    ),
    stem_a: (
      <TableCell className="max-w-[260px]" title={stemPlain(item, "A")}>
        {stemA || "-"}
      </TableCell>
    ),
    stem_b: (
      <TableCell className="max-w-[260px]" title={stemPlain(item, "B")}>
        {stemB || "-"}
      </TableCell>
    ),
    match: (
      <TableCell className="whitespace-nowrap">
        {duplicateComparisonMatchLabel(item.comparisonKind)}
      </TableCell>
    ),
    recommendation: (
      <TableCell className="whitespace-nowrap">
        {duplicateRecommendationLabel(
          item.recommendation,
          item.suggestedMergeDirection,
        )}
      </TableCell>
    ),
  };

  return (
    <TableRow className={cn(tutorTableBodyRow)}>
      {visibleColumnKeys
        .map((key) => cells[key])
        .filter((cell): cell is React.ReactNode => cell != null)}
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className={tutorBtnOutline}
          onClick={onCompare}
        >
          Compare
        </Button>
      </TableCell>
    </TableRow>
  );
}
