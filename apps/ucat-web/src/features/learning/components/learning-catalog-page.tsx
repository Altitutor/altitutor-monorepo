"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BookOpen, ChevronRight, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import {
  buildLearningModuleTree,
  groupModulesBySection,
} from "@/features/learning/lib/build-module-tree";
import type { LearningModuleTreeNode } from "@/features/learning/types";
import { cn } from "@/lib/utils";

function progressLabel(node: LearningModuleTreeNode): string {
  const percent = Number(node.completion_percent ?? 0);
  if (node.kind === "lesson") {
    return node.completed_at ? "Complete" : `${percent}%`;
  }
  return `${percent}%`;
}

function ModuleTreeNode({
  node,
  depth = 0,
}: {
  node: LearningModuleTreeNode;
  depth?: number;
}) {
  const href =
    node.kind === "lesson" && node.id
      ? `/learn/${node.id}`
      : undefined;

  const row = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2",
        href && "hover:bg-muted/60",
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {node.kind === "folder" ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-medium">{node.title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <span>{progressLabel(node)}</span>
        {href ? <ChevronRight className="size-4" /> : null}
      </div>
    </div>
  );

  return (
    <div>
      {href ? <Link href={href}>{row}</Link> : row}
      {node.children.map((child) =>
        child.id ? (
          <ModuleTreeNode key={child.id} node={child} depth={depth + 1} />
        ) : null,
      )}
    </div>
  );
}

export function LearningCatalogPage() {
  const { data: modules, isLoading, error } = useLearningModules();

  const sections = useMemo(() => {
    const tree = buildLearningModuleTree(modules ?? []);
    return groupModulesBySection(tree);
  }, [modules]);

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Learn"
        description="Browse learning modules and track your progress."
      />
      <QuotaUsageCard area="learn" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading modules...</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load learning modules.</p>
      ) : null}

      {!isLoading && !error && sections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No learning modules are available yet.
          </CardContent>
        </Card>
      ) : null}

      {sections.map((section) => (
        <Card key={section.sectionId ?? "general"}>
          <CardHeader>
            <CardTitle>{section.sectionName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {section.nodes.map((node) =>
              node.id ? <ModuleTreeNode key={node.id} node={node} /> : null,
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
