"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { LearningModuleCatalogTree } from "@/features/learning/components/learning-module-catalog-tree";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import {
  buildLearningModuleTree,
  groupModulesBySection,
} from "@/features/learning/lib/build-module-tree";

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
          <CardContent>
            <LearningModuleCatalogTree nodes={section.nodes} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
