"use client";
import { TutorEntityToolbar } from '@/features/quick-filters/components/TutorEntityToolbar'
import { tutorDefaultDisplaySettings } from '@altitutor/shared'

import { useState } from "react";
import { Button, Input } from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import type { DataTableSortOption, InterviewCategory } from "@altitutor/shared";
import { Pencil, Plus } from "lucide-react";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { isDescendantOf } from "@/features/ucat/shared/lib/taxonomy-reparent";
import {
  TaxonomyHierarchyDndProvider,
} from "@/features/ucat/shared/components/taxonomy-hierarchy-dnd";
import {
  TaxonomyHierarchyTree,
  TaxonomySectionDropZone,
  type TaxonomyHierarchyNode,
  type TaxonomyReparentTarget,
} from "@/features/ucat/shared/components/taxonomy-hierarchy-tree";
import { tutorBtnOutline, tutorBtnPrimary, tutorToolbarProps } from "@/shared/lib/tutor-visual";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import {
  InterviewError,
  InterviewField,
  InterviewSelect,
} from "./interview-ui";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import { useInterviewTable } from "./interview-table";

const sortOptions: DataTableSortOption[] = [{ key: "name", label: "Name" }];

type CategoryNode = TaxonomyHierarchyNode;

function buildTree(
  categories: InterviewCategory[],
  stationCount: (id: string) => number,
  parentId: string | null,
  direction: "asc" | "desc",
): CategoryNode[] {
  const sign = direction === "asc" ? 1 : -1;
  return categories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name) * sign)
    .map((category) => {
      const children = buildTree(categories, stationCount, category.id, direction);
      return {
        id: category.id,
        name: category.name,
        child_count: children.length,
        item_count: stationCount(category.id),
        children,
      };
    });
}

function filterTree(nodes: CategoryNode[], search: string): CategoryNode[] {
  const query = search.trim().toLowerCase();
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, search);
    if (node.name.toLowerCase().includes(query) || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
}

export function InterviewCategoriesPage() {
  const catalogQuery = useInterviewCatalog();
  const catalog = catalogQuery.data;
  const command = useInterviewCommand();
  const table = useInterviewTable(["name"]);
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);

  const categories = catalog?.categories ?? [];
  const stationCount = (id: string) =>
    (catalog?.stations ?? []).filter(
      (station) => !station.archived && station.categoryId === id,
    ).length;
  const nodes = filterTree(
    buildTree(
      categories,
      stationCount,
      null,
      table.state.sortDirection === "desc" ? "desc" : "asc",
    ),
    table.state.search,
  );
  const editing = categories.find((category) => category.id === editingId) ?? null;
  const blockedParents = new Set<string>();
  if (editing) {
    blockedParents.add(editing.id);
    for (const category of categories) {
      if (
        isDescendantOf(
          categories.map((item) => ({ id: item.id, parent_id: item.parentId })),
          category.id,
          editing.id,
        )
      ) {
        blockedParents.add(category.id);
      }
    }
  }

  const openEdit = (id: string) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return;
    setCreating(false);
    setEditingId(id);
    setName(category.name);
    setParentId(category.parentId);
  };

  const save = async () => {
    const id = editing?.id ?? randomUuid();
    await command.mutateAsync({
      type: "saveCategory",
      commandId: randomUuid(),
      category: { id, name: name.trim(), parentId },
    });
    setCreating(false);
    setEditingId(null);
    setName("");
    setParentId(null);
  };

  const reparent = async (itemId: string, target: TaxonomyReparentTarget) => {
    const category = categories.find((item) => item.id === itemId);
    if (!category) return;
    const nextParent = target.type === "root" ? null : target.parentId;
    if (nextParent === itemId) return;
    if (
      nextParent &&
      isDescendantOf(
        categories.map((item) => ({ id: item.id, parent_id: item.parentId })),
        nextParent,
        itemId,
      )
    ) {
      return;
    }
    await command.mutateAsync({
      type: "saveCategory",
      commandId: randomUuid(),
      category: { ...category, parentId: nextParent },
    });
  };

  const form = (
    <div className="space-y-4">
      <InterviewField label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </InterviewField>
      <InterviewSelect
        label="Parent category"
        clear
        value={parentId}
        options={categories
          .filter((category) => !blockedParents.has(category.id))
          .map((category) => ({ id: category.id, label: category.name }))}
        onChange={setParentId}
      />
      <InterviewError error={command.error} />
    </div>
  );

  const hierarchy = (
    <TaxonomySectionDropZone sectionId="interviews" sectionName="Categories" editMode={editMode}>
      {nodes.length ? (
        <TaxonomyHierarchyTree
          nodes={nodes}
          itemCountNoun="station"
          onItemClick={openEdit}
          searchQuery={table.state.search}
          editMode={editMode}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {categories.length
            ? "No categories match this search."
            : "No categories yet."}
        </p>
      )}
    </TaxonomySectionDropZone>
  );

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Station categories"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Station categories")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={editMode ? "default" : "outline"}
              className={editMode ? undefined : tutorBtnOutline}
              onClick={() => setEditMode((previous) => !previous)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? "Done reordering" : "Edit hierarchy"}
            </Button>
            <Button
              className={tutorBtnPrimary}
              onClick={() => {
                setEditingId(null);
                setName("");
                setParentId(null);
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add category
            </Button>
          </div>
        }
      />
      <InterviewError
        error={catalogQuery.error}
        retry={() => void catalogQuery.refetch()}
      />
      <TutorEntityToolbar
        pageKey={'interview_categories'}
        defaultSettings={tutorDefaultDisplaySettings(table.state.defaultVisibleColumns ?? [])}
        state={table.state}
        onSearchChange={table.actions.onSearchChange}
        onFiltersChange={table.actions.onFiltersChange}
        onSortChange={table.actions.onSortChange}
        onGroupByChange={table.actions.onGroupByChange}
        onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
        onQuickFilterApply={table.actions.onQuickFilterApply}
        onReset={table.actions.onReset}
        sortOptions={sortOptions}
        searchPlaceholder="Search categories"
        {...tutorToolbarProps}
      />
      {!catalog && catalogQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading categories…</p>
      ) : editMode ? (
        <TaxonomyHierarchyDndProvider allNodes={nodes} onReparent={(id, target) => void reparent(id, target)}>
          {hierarchy}
        </TaxonomyHierarchyDndProvider>
      ) : (
        hierarchy
      )}
      <UcatDialogShell
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditingId(null);
          setName("");
          setParentId(null);
        }}
        title={editing ? "Edit category" : "Create category"}
        subtitle="Categories group whole interview stations."
        onSave={() => void save().catch(() => undefined)}
        saveLabel={editing ? "Save" : "Create"}
        saveDisabled={!name.trim() || command.isPending}
        isSaving={command.isPending}
      >
        <div className="h-full overflow-y-auto p-6">{form}</div>
      </UcatDialogShell>
    </div>
  );
}
