"use client";

import { SearchableSelect } from "@altitutor/ui";
import { SegmentedControl } from "./segmented-control";
import { ProgressAttemptFilterSelector } from "./progress-attempt-filter-selector";
import {
  type ProgressMode,
  type TimeFrameDays,
  type AttemptFilter,
  TIME_FRAME_OPTIONS,
} from "../lib/progress-mode";

type ProgressModeSelectorProps = {
  mode: ProgressMode;
  onModeChange: (mode: ProgressMode) => void;
  timeFrameDays: TimeFrameDays;
  onTimeFrameDaysChange: (days: TimeFrameDays) => void;
  attemptFilter?: AttemptFilter;
  onAttemptFilterChange?: (filter: AttemptFilter) => void;
  /** When false, hides the attempt filter (e.g. for mocks page). Default true */
  showAttemptFilter?: boolean;
  className?: string;
};

export function ProgressModeSelector({
  mode,
  onModeChange,
  timeFrameDays,
  onTimeFrameDaysChange,
  attemptFilter = "all",
  onAttemptFilterChange,
  showAttemptFilter = true,
  className,
}: ProgressModeSelectorProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={mode}
          onValueChange={(v) => onModeChange(v as ProgressMode)}
          options={[
            { value: "all_time", label: "All time" },
            {
              value: "weighted",
              label: "Weighted average",
              infoTooltip:
                "Recent attempts are weighted more heavily than older ones. Percentages and scaled scores use EMA; counts show all time.",
            },
            { value: "time_frame", label: "Time frame" },
          ]}
        />
        {mode === "time_frame" && (
          <SearchableSelect<(typeof TIME_FRAME_OPTIONS)[number]>
            items={[...TIME_FRAME_OPTIONS]}
            value={
              TIME_FRAME_OPTIONS.find((r) => r.value === timeFrameDays) ?? null
            }
            onValueChange={(item) => item && onTimeFrameDaysChange(item.value)}
            getItemLabel={(r) => r.label}
            getItemId={(r) => r.value}
            placeholder="Days"
            triggerClassName="w-[100px]"
          />
        )}
        {showAttemptFilter && onAttemptFilterChange && (
          <ProgressAttemptFilterSelector
            value={attemptFilter}
            onValueChange={onAttemptFilterChange}
          />
        )}
      </div>
    </div>
  );
}
