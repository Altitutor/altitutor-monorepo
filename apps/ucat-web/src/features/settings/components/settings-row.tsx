"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  title,
  description,
  control,
}: {
  title: string;
  description: ReactNode;
  control: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 py-6 last:border-b-0 last:pb-0 first:pt-0",
        "sm:flex-row sm:items-start sm:justify-between sm:gap-8",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="w-full shrink-0 sm:flex sm:max-w-xs sm:justify-end">{control}</div>
    </div>
  );
}
