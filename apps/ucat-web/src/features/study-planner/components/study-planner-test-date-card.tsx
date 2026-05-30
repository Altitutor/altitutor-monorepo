"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Badge } from "@altitutor/ui";
import { ucatDashboardNavTileClassName } from "@/lib/ucat-surface-motion";

type StudyPlannerTestDateCardProps = {
  testDate: string | null;
};

function getDaysRemaining(testDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${testDate}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function urgency(daysRemaining: number): "high" | "medium" | "low" {
  if (daysRemaining < 7) return "high";
  if (daysRemaining <= 30) return "medium";
  return "low";
}

export function StudyPlannerTestDateCard({ testDate }: StudyPlannerTestDateCardProps) {
  const className = ucatDashboardNavTileClassName();

  if (!testDate) {
    return (
      <Link href="/settings/study-planner" className={className}>
        <div className="flex w-full items-start justify-between">
          <div className="rounded-lg bg-muted/60 p-2.5">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Setup needed
          </Badge>
        </div>
        <h3 className="mt-4 font-semibold">Test date countdown</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your UCAT test date to unlock countdown and pacing guidance.
        </p>
      </Link>
    );
  }

  const daysRemaining = getDaysRemaining(testDate);
  const level = urgency(daysRemaining);
  const badgeLabel =
    level === "high" ? "Urgent" : level === "medium" ? "Soon" : "On track";

  return (
    <Link href="/settings/study-planner" className={className}>
      <div className="flex w-full items-start justify-between">
        <div className="rounded-lg bg-muted/60 p-2.5">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {badgeLabel}
        </Badge>
      </div>
      <h3 className="mt-4 font-semibold">Test date countdown</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {daysRemaining >= 0
          ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
          : "Test date has passed"}
      </p>
    </Link>
  );
}
