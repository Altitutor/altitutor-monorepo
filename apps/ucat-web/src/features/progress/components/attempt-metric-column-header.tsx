"use client";

import { Info } from "lucide-react";
import {
  SearchableSelect,
  TableHead,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { ProgressOutlineSelectTrigger } from "./progress-outline-select-trigger";

export type AttemptMetricOption<T extends string = string> = {
  value: T;
  label: string;
};

type AttemptMetricColumnHeaderProps<T extends string> = {
  options: AttemptMetricOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  tooltip: string;
};

/** Table metric header that opens a searchable select to change the column. */
export function AttemptMetricColumnHeader<T extends string>({
  options,
  value,
  onValueChange,
  label,
  tooltip,
}: AttemptMetricColumnHeaderProps<T>) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <TableHead>
      <SearchableSelect<AttemptMetricOption<T>>
        items={options}
        value={selected}
        onValueChange={(item) => {
          if (item) onValueChange(item.value);
        }}
        getItemLabel={(item) => item.label}
        getItemId={(item) => item.value}
        searchPlaceholder="Search metrics..."
        emptyMessage="No metrics found."
        align="start"
        contentWidth="220px"
        showChevron={false}
        trigger={
          <ProgressOutlineSelectTrigger
            label={label}
            ariaLabel={`${label}. Click to change metric.`}
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex cursor-help text-muted-foreground hover:text-foreground"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ProgressOutlineSelectTrigger>
        }
      />
    </TableHead>
  );
}
