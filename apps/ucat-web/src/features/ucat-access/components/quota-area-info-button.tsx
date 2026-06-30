"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";

const QUOTA_AREA_DESCRIPTIONS: Record<UcatQuotaArea, string> = {
  practice:
    "Counts each new unique question on a submitted practice stem, including unanswered questions. Loading a stem does not count until the stem is submitted.",
  sets:
    "Counts each standalone set attempt when you start it. Reviewing or continuing the same attempt does not count again.",
  mocks:
    "Counts each mock attempt when you start it. Reviewing or continuing the same mock attempt does not count again.",
  learn:
    "Counts each learning module lesson the first time you open it. Lessons marked Started or Complete have already been viewed and will not count again. Folders do not count.",
  skill_trainer:
    "Counts each skill trainer attempt when you start it. Reviewing results or continuing the same attempt does not count again.",
};

type QuotaAreaInfoButtonProps = {
  area: UcatQuotaArea;
  label: string;
};

export function QuotaAreaInfoButton({ area, label }: QuotaAreaInfoButtonProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35"
            aria-label={`What ${label} counts`}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-sm">
          {QUOTA_AREA_DESCRIPTIONS[area]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
