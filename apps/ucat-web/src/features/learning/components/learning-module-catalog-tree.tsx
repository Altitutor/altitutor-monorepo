"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import type { LearningModuleTreeNode } from "@/features/learning/types";
import { cn } from "@/lib/utils";

function progressLabel(node: LearningModuleTreeNode): string {
  const percent = Number(node.completion_percent ?? 0);
  if (node.kind === "lesson") {
    return node.completed_at ? "Complete" : `${percent}%`;
  }
  return `${percent}%`;
}

function LearningModuleCatalogTreeNode({
  node,
  depth = 0,
}: {
  node: LearningModuleTreeNode;
  depth?: number;
}) {
  const isFolder = node.kind === "folder";
  const hasChildren = node.children.length > 0;
  const [expanded, setExpanded] = useState(depth === 0);

  const toggleExpanded = () => {
    if (hasChildren) setExpanded((prev) => !prev);
  };

  return (
    <li className="rounded-lg">
      {isFolder ? (
        <button
          type="button"
          onClick={toggleExpanded}
          disabled={!hasChildren}
          aria-label={expanded ? `Collapse ${node.title}` : `Expand ${node.title}`}
          aria-expanded={hasChildren ? expanded : undefined}
          className={cn(
            "flex w-full items-center gap-1 rounded-lg py-1.5 pl-1 pr-2.5 text-left transition-colors duration-300",
            hasChildren ? "cursor-pointer hover:bg-muted/80" : "cursor-default",
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out",
                hasChildren && expanded && "rotate-90",
                !hasChildren && "opacity-0",
              )}
            />
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
            title={node.title ?? undefined}
          >
            {node.title}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {progressLabel(node)}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-1 py-0.5 pl-0 pr-1">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center opacity-0"
          />
          <Link
            href={node.id ? `/learn/${node.id}` : "#"}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-300 hover:bg-muted/80"
          >
            <span className="flex min-w-0 items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate" title={node.title ?? undefined}>
                {node.title}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
              <span className="text-xs tabular-nums">{progressLabel(node)}</span>
              <ChevronRight className="size-4" />
            </span>
          </Link>
        </div>
      )}

      {isFolder && hasChildren ? (
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="pl-3">
              <LearningModuleCatalogTree nodes={node.children} depth={depth + 1} />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

type LearningModuleCatalogTreeProps = {
  nodes: LearningModuleTreeNode[];
  depth?: number;
  className?: string;
};

export function LearningModuleCatalogTree({
  nodes,
  depth = 0,
  className,
}: LearningModuleCatalogTreeProps) {
  if (!nodes.length) {
    return null;
  }

  return (
    <ul className={cn("space-y-0", className)}>
      {nodes.map((node) =>
        node.id ? (
          <LearningModuleCatalogTreeNode key={node.id} node={node} depth={depth} />
        ) : null,
      )}
    </ul>
  );
}
