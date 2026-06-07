"use client";

import { Skeleton } from "@altitutor/ui";
import { cn } from "@/lib/utils";

type PlanPickerPriceSkeletonProps = {
  /** Pro card — lighter bones on dark background */
  featured?: boolean;
};

export function PlanPickerPriceSkeleton({
  featured = false,
}: PlanPickerPriceSkeletonProps) {
  const bone = featured ? "bg-marketing-cream/15" : undefined;

  return (
    <div
      className="mt-6 space-y-2.5"
      aria-busy="true"
      aria-label="Loading pricing"
    >
      <div className="flex flex-wrap items-end gap-2">
        <Skeleton className={cn("h-10 w-28 rounded-md", bone)} />
        <Skeleton className={cn("mb-0.5 h-4 w-14 rounded-md", bone)} />
        <Skeleton className={cn("mb-0.5 h-4 w-40 rounded-md", bone)} />
      </div>
      <Skeleton className={cn("h-4 w-full max-w-sm rounded-md", bone)} />
    </div>
  );
}
