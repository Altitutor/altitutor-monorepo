"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { CheckCircle2, Clock3, PlayCircle } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { LearningCatalogPageSkeleton } from "@/features/learning/components/learning-catalog-page-skeleton";
import { useLearnQuotaGate } from "@/features/learning/hooks/use-learn-quota-gate";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import { buildLearningModuleTree } from "@/features/learning/lib/build-module-tree";
import { getLearningModuleIcon } from "@/features/learning/lib/learning-module-icons";
import { learningModuleHref } from "@/features/learning/lib/learning-module-href";
import type { LearningModuleTreeNode } from "@/features/learning/types";
import { SECTION_NUMBER_TO_NAME } from "@/features/sets/lib/section-labels";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { cn } from "@/lib/utils";

type FolderNavItem = {
  id: string;
  title: string;
  depth: number;
};

function collectFolders(
  nodes: LearningModuleTreeNode[],
  depth = 0,
): FolderNavItem[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "folder" || !node.id) return [];
    return [
      { id: node.id, title: node.title ?? "Untitled folder", depth },
      ...collectFolders(node.children, depth + 1),
    ];
  });
}

function collectLessons(
  nodes: LearningModuleTreeNode[],
): LearningModuleTreeNode[] {
  return nodes.flatMap((node) =>
    node.kind === "lesson" ? [node] : collectLessons(node.children),
  );
}

function lessonStatus(node: LearningModuleTreeNode) {
  if (node.completed_at) return "Complete";
  if (node.started_at) return "In progress";
  return "Not started";
}

function LearningModuleCard({
  node,
  isNext,
}: {
  node: LearningModuleTreeNode;
  isNext: boolean;
}) {
  const { guardLessonClick } = useLearnQuotaGate();
  const Icon = getLearningModuleIcon(node.icon_key);
  const percent = Math.round(Number(node.completion_percent ?? 0));
  const complete = Boolean(node.completed_at);
  const started = Boolean(node.started_at);

  return (
    <UcatClickableCardLink
      href={node.id ? learningModuleHref(node.id, node.section_number) : "#"}
      onClick={(event) => guardLessonClick(event, node)}
      icon={Icon}
      title={node.title ?? "Untitled learning module"}
      description={node.description || "Open this module to start learning."}
      trailing={
        isNext ? (
          <Badge className="gap-1">
            <PlayCircle className="size-3" />
            Next up
          </Badge>
        ) : undefined
      }
      footer={
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 shrink-0 items-center">
            <span className="inline-flex items-center gap-1.5">
              {complete ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <span
                  className={cn(
                    "size-2 rounded-full",
                    started ? "bg-primary" : "bg-muted-foreground/40",
                  )}
                />
              )}
              {lessonStatus(node)}
            </span>
          </div>
          <div
            className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-muted"
            aria-label={`${percent}% complete`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          {node.estimated_minutes ? (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <Clock3 className="size-4" />
              {node.estimated_minutes} min
            </span>
          ) : null}
        </div>
      }
      className={cn(
        "h-full",
        isNext && "border-primary/60 ring-1 ring-primary/20",
      )}
    />
  );
}

function LessonGrid({
  lessons,
  nextLessonId,
}: {
  lessons: LearningModuleTreeNode[];
  nextLessonId: string | null;
}) {
  if (!lessons.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {lessons.map((lesson) => (
        <LearningModuleCard
          key={lesson.id}
          node={lesson}
          isNext={lesson.id === nextLessonId}
        />
      ))}
    </div>
  );
}

function FolderSections({
  nodes,
  nextLessonId,
  depth = 0,
}: {
  nodes: LearningModuleTreeNode[];
  nextLessonId: string | null;
  depth?: number;
}) {
  return nodes.map((folder) => {
    if (folder.kind !== "folder" || !folder.id) return null;
    const lessons = folder.children.filter((child) => child.kind === "lesson");
    const childFolders = folder.children.filter(
      (child) => child.kind === "folder",
    );
    return (
      <section
        key={folder.id}
        id={`folder-${folder.id}`}
        className="scroll-mt-6 space-y-4"
      >
        <div className="space-y-1">
          {depth === 0 ? (
            <h2 className="text-xl font-semibold tracking-tight">
              {folder.title}
            </h2>
          ) : (
            <h3 className="text-lg font-semibold tracking-tight">
              {folder.title}
            </h3>
          )}
          {folder.description ? (
            <p className="text-sm text-muted-foreground">
              {folder.description}
            </p>
          ) : null}
        </div>
        <LessonGrid lessons={lessons} nextLessonId={nextLessonId} />
        {childFolders.length ? (
          <div
            className={cn("space-y-8", depth === 0 && "border-l pl-4 sm:pl-6")}
          >
            <FolderSections
              nodes={childFolders}
              nextLessonId={nextLessonId}
              depth={depth + 1}
            />
          </div>
        ) : null}
      </section>
    );
  });
}

export function LearningSectionPage({
  sectionNumber,
}: {
  sectionNumber: number;
}) {
  const { data: modules, isLoading, error } = useLearningModules();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const sectionName =
    SECTION_NUMBER_TO_NAME[sectionNumber] ?? `Section ${sectionNumber}`;

  const tree = useMemo(
    () =>
      buildLearningModuleTree(
        (modules ?? []).filter(
          (module) => module.section_number === sectionNumber,
        ),
      ),
    [modules, sectionNumber],
  );
  const folders = useMemo(() => collectFolders(tree), [tree]);
  const lessons = useMemo(() => collectLessons(tree), [tree]);
  const rootLessons = tree.filter((node) => node.kind === "lesson");
  const nextLessonId =
    lessons.find((lesson) => !lesson.completed_at)?.id ?? null;

  if (isLoading) return <LearningCatalogPageSkeleton />;

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={`${sectionName} learning`}
        description="Choose a module to continue learning."
        backHref="/learn"
        backLabel="Back to Learn"
      />

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load learning modules.
        </p>
      ) : null}

      {!error && lessons.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No learning modules are available for this section yet.
          </CardContent>
        </Card>
      ) : null}

      {lessons.length ? (
        <div className="flex flex-col gap-8 lg:flex-row">
          <motion.div
            className="min-w-0 flex-1 space-y-10"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {rootLessons.length ? (
              <motion.section variants={itemVariants} className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  Modules
                </h2>
                <LessonGrid lessons={rootLessons} nextLessonId={nextLessonId} />
              </motion.section>
            ) : null}
            <motion.div variants={itemVariants} className="space-y-10">
              <FolderSections nodes={tree} nextLessonId={nextLessonId} />
            </motion.div>
          </motion.div>

          {folders.length ? (
            <aside className="order-first w-full shrink-0 lg:order-last lg:sticky lg:top-20 lg:w-64 lg:self-start">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">On this page</CardTitle>
                </CardHeader>
                <CardContent>
                  <nav aria-label="Learning folders">
                    <ul className="space-y-1">
                      {folders.map((folder) => (
                        <li
                          key={folder.id}
                          style={{ paddingLeft: `${folder.depth * 12}px` }}
                        >
                          <a
                            href={`#folder-${folder.id}`}
                            className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {folder.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </CardContent>
              </Card>
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
