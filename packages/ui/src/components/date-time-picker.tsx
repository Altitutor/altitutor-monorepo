"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SmartDatePickerField } from "./smart-date-picker";
import { TimePicker } from "./time-picker";

function parts(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
      }
    : { date: "", time: "09:00" };
}
/** Local wall-clock selection; the public value is an absolute ISO instant. */
export function DateTimePickerPopover({
  value,
  onChange,
  children,
  label = "Date and time",
  minDate,
  maxDate,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  children: React.ReactElement;
  label?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [selection, setSelection] = React.useState(() => parts(value));
  const emitted = React.useRef(value);
  React.useEffect(() => {
    if (emitted.current !== value) {
      emitted.current = value;
      setSelection(parts(value));
    }
  }, [value]);
  function update(next: typeof selection) {
    setSelection(next);
    const instant =
      next.date && next.time ? new Date(`${next.date}T${next.time}`) : null;
    const result =
      instant && Number.isFinite(instant.getTime())
        ? instant.toISOString()
        : null;
    emitted.current = result;
    onChange(result);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 space-y-3 p-3"
        aria-label={label}
      >
        <p className="text-sm font-medium">{label}</p>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Date</span>
          <SmartDatePickerField
            value={selection.date || null}
            valueFormat="date"
            onChange={(date) =>
              update({ ...selection, date: date?.slice(0, 10) ?? "" })
            }
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Time</span>
          <TimePicker
            aria-label={`${label} time`}
            value={selection.time}
            onChange={(time) => update({ ...selection, time })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Your local time</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => update({ date: "", time: "09:00" })}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
