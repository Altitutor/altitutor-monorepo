"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useSections } from "@/features/progress/hooks/use-sections";
import {
  useStudyPlannerSettings,
  useUpdateStudyPlannerSettings,
} from "@/features/study-planner/hooks/use-study-planner-settings";
import { UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type TargetInputs = {
  s1: string;
  s2: string;
  s3: string;
};

function toInput(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseTarget(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
}

export function SettingsStudyPlannerPage() {
  const settingsQuery = useStudyPlannerSettings();
  const sectionsQuery = useSections();
  const updateMutation = useUpdateStudyPlannerSettings();

  const [testDate, setTestDate] = useState("");
  const [targets, setTargets] = useState<TargetInputs>({
    s1: "",
    s2: "",
    s3: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setTestDate(settingsQuery.data.testDate ?? "");
    setTargets({
      s1: toInput(settingsQuery.data.targetScores.s1),
      s2: toInput(settingsQuery.data.targetScores.s2),
      s3: toInput(settingsQuery.data.targetScores.s3),
    });
    setError(null);
  }, [settingsQuery.data]);

  const sectionNames = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const section of sectionsQuery.data ?? []) {
      if (section.sectionNumber >= 1 && section.sectionNumber <= 3) {
        byNumber.set(section.sectionNumber, section.name);
      }
    }
    return {
      s1: byNumber.get(1) ?? "Section 1",
      s2: byNumber.get(2) ?? "Section 2",
      s3: byNumber.get(3) ?? "Section 3",
    };
  }, [sectionsQuery.data]);

  const loading = settingsQuery.isLoading || sectionsQuery.isLoading;

  const handleSave = async () => {
    setError(null);

    const parsedS1 = parseTarget(targets.s1);
    const parsedS2 = parseTarget(targets.s2);
    const parsedS3 = parseTarget(targets.s3);

    for (const [key, value] of [
      ["Section 1", parsedS1],
      ["Section 2", parsedS2],
      ["Section 3", parsedS3],
    ] as const) {
      if (value !== null && Number.isNaN(value)) {
        setError(`${key} target must be a number between 300 and 900.`);
        return;
      }
      if (typeof value === "number" && (value < 300 || value > 900)) {
        setError(`${key} target must be a number between 300 and 900.`);
        return;
      }
    }

    try {
      await updateMutation.mutateAsync({
        testDate: testDate || null,
        targetScores: {
          s1: parsedS1,
          s2: parsedS2,
          s3: parsedS3,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Study planner settings"
          description="Loading your UCAT planning settings..."
          backHref="/settings"
          backLabel="All settings"
        />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (settingsQuery.error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Study planner settings"
          description="Could not load your settings."
          backHref="/settings"
          backLabel="All settings"
        />
        <p className="text-sm text-destructive">{settingsQuery.error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Study planner settings"
        description="Set your test date and section targets to drive score projections."
        backHref="/settings"
        backLabel="All settings"
      />

      <div
        className={cn(
          "space-y-6 rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="study-planner-test-date">UCAT test date</Label>
          <Input
            id="study-planner-test-date"
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="target-s1">{sectionNames.s1} target score</Label>
            <Input
              id="target-s1"
              type="number"
              min={300}
              max={900}
              value={targets.s1}
              onChange={(e) =>
                setTargets((prev) => ({ ...prev, s1: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-s2">{sectionNames.s2} target score</Label>
            <Input
              id="target-s2"
              type="number"
              min={300}
              max={900}
              value={targets.s2}
              onChange={(e) =>
                setTargets((prev) => ({ ...prev, s2: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-s3">{sectionNames.s3} target score</Label>
            <Input
              id="target-s3"
              type="number"
              min={300}
              max={900}
              value={targets.s3}
              onChange={(e) =>
                setTargets((prev) => ({ ...prev, s3: e.target.value }))
              }
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
