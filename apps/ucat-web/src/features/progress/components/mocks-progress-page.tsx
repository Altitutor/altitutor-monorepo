"use client";

import { Skeleton } from "@altitutor/ui";
import { useMockProgress } from "../hooks/use-progress";
import { MockAttemptsCard } from "./mock-attempts-card";

export function MocksProgressPage() {
  const { data, isLoading, error } = useMockProgress();

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="mx-auto h-80 w-[calc(100%-3rem)] max-w-[1352px] rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-10">
        <h1 className="text-2xl font-semibold">Mock progress</h1>
        <p className="mt-2 text-sm text-destructive">
          {error?.message ?? "No mock progress data is available."}
        </p>
      </div>
    );
  }

  return <MockAttemptsCard summary={data} />;
}
