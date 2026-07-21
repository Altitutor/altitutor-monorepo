"use client";

import { Skeleton } from "@altitutor/ui";
import { UcatPageHeader } from "@/features/layout";
import { useMockProgress } from "../hooks/use-progress";
import { MockAttemptsCard } from "./mock-attempts-card";

export function MocksProgressPage() {
  const { data, isLoading, error } = useMockProgress();

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="mx-auto w-full max-w-[1400px] px-5 pt-6 sm:px-6">
          <UcatPageHeader
            title="Mock progress"
            backHref="/progress"
            backLabel="Back to progress"
          />
        </div>
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="mx-auto h-80 w-[calc(100%-3rem)] max-w-[1352px] rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 sm:px-6">
        <UcatPageHeader
          title="Mock progress"
          backHref="/progress"
          backLabel="Back to progress"
        />
        <p className="text-sm text-destructive">
          {error?.message ?? "No mock progress data is available."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-6 sm:px-6">
        <UcatPageHeader
          title="Mock progress"
          backHref="/progress"
          backLabel="Back to progress"
        />
      </div>
      <MockAttemptsCard summary={data} />
    </div>
  );
}
