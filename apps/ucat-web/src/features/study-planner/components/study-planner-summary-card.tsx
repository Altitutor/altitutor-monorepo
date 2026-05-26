"use client";

import Link from "next/link";
import { LineChart } from "lucide-react";
import { Badge } from "@altitutor/ui";
import type { StudyPlannerProjectionResponse } from "@/features/study-planner/types/study-planner";
import { ucatDashboardNavTileClassName } from "@/lib/ucat-surface-motion";

type StudyPlannerSummaryCardProps = {
  projection: StudyPlannerProjectionResponse | null;
  isLoading?: boolean;
};

function formatStatusLabel(status: "ahead" | "on_track" | "behind" | "at_risk"): string {
  if (status === "on_track") return "On track";
  if (status === "at_risk") return "At risk";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function StudyPlannerSummaryCard({
  projection,
  isLoading = false,
}: StudyPlannerSummaryCardProps) {
  const className = ucatDashboardNavTileClassName();

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex w-full items-start justify-between">
          <div className="rounded-lg bg-muted/60 p-2.5">
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <h3 className="mt-4 font-semibold">Study summary</h3>
        <p className="mt-1 text-sm text-muted-foreground">Loading projection...</p>
      </div>
    );
  }

  if (!projection || projection.sections.length === 0) {
    return (
      <Link href="/progress" className={className}>
        <div className="flex w-full items-start justify-between">
          <div className="rounded-lg bg-muted/60 p-2.5">
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <h3 className="mt-4 font-semibold">Study summary</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your first set to start personalized score projections.
        </p>
      </Link>
    );
  }

  const statuses = projection.sections
    .map((s) => s.target?.trajectoryStatus)
    .filter((s): s is "ahead" | "on_track" | "behind" | "at_risk" => Boolean(s));
  const topStatus =
    statuses.find((s) => s === "at_risk") ??
    statuses.find((s) => s === "behind") ??
    statuses.find((s) => s === "on_track") ??
    statuses[0] ??
    null;

  const first = projection.sections[0];
  const confidenceLabel =
    first.confidence === "high"
      ? "High confidence"
      : first.confidence === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return (
    <Link href="/progress" className={className}>
      <div className="flex w-full items-start justify-between">
        <div className="rounded-lg bg-muted/60 p-2.5">
          <LineChart className="h-5 w-5 text-muted-foreground" />
        </div>
        {topStatus ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {formatStatusLabel(topStatus)}
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-4 font-semibold">Study summary</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {`S1 ${Math.round(projection.sections[0]?.sHat ?? 0)} · S2 ${Math.round(projection.sections[1]?.sHat ?? 0)} · S3 ${Math.round(projection.sections[2]?.sHat ?? 0)}`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{confidenceLabel}</p>
    </Link>
  );
}
