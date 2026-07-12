"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { LearningCatalogPageSkeleton } from "@/features/learning/components/learning-catalog-page-skeleton";
import { LearningModuleCatalogTree } from "@/features/learning/components/learning-module-catalog-tree";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import {
  buildLearningModuleTree,
  groupModulesBySection,
} from "@/features/learning/lib/build-module-tree";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function LearningCatalogPage() {
  const { data: modules, isLoading, error } = useLearningModules();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  const sections = useMemo(() => {
    const tree = buildLearningModuleTree(modules ?? []);
    return groupModulesBySection(tree);
  }, [modules]);

  if (isLoading) {
    return <LearningCatalogPageSkeleton />;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div id="tour-learn-page" variants={itemVariants}>
        <UcatPageHeader
          title="Learn"
          description="Browse learning modules and track your progress."
        />
      </motion.div>

      {error ? (
        <motion.p variants={itemVariants} className="text-sm text-destructive">
          Failed to load learning modules.
        </motion.p>
      ) : null}

      {!error && sections.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No learning modules are available yet.
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {sections.map((section) => (
        <motion.div key={section.sectionId ?? "general"} variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>{section.sectionName}</CardTitle>
            </CardHeader>
            <CardContent>
              <LearningModuleCatalogTree nodes={section.nodes} />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
