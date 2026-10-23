"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import {
  toolbarControlStyles,
  toolbarControlSelectedStyles,
} from "../lib/toolbar-control-styles";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SearchableSelect } from "./searchable-select";
import { Input } from "./input";

export type ToolbarFilterOperator =
  | "contains"
  | "equals"
  | "not_contains"
  | "any"
  | "all"
  | "none";
export type ToolbarFilterCondition = {
  fieldKey: string;
  operator: ToolbarFilterOperator;
  values: string[];
};
export type ToolbarConditionField = {
  key: string;
  label: string;
  type: "text" | "choice";
  options?: Array<{ value: string; label: string }>;
};
export type ToolbarConditionFilters = {
  fields: ToolbarConditionField[];
  value: ToolbarFilterCondition[];
  onChange: (conditions: ToolbarFilterCondition[]) => void;
};
export const TEXT_FILTER_OPERATORS: Array<{
  value: ToolbarFilterOperator;
  label: string;
}> = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "is" },
  { value: "not_contains", label: "does not contain" },
];
export const CHOICE_FILTER_OPERATORS: Array<{
  value: ToolbarFilterOperator;
  label: string;
}> = [
  { value: "any", label: "contains any" },
  { value: "all", label: "contains all" },
  { value: "none", label: "contains none" },
];

export const filterSegmentClass =
  "inline-flex whitespace-nowrap min-h-8 min-w-0 items-center gap-1 px-2.5 text-xs outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export function FilterPill({
  field,
  fields,
  onFieldChange,
  operator,
  operators,
  onOperatorChange,
  value,
  valueEditor,
  onRemove,
}: {
  field: { value: string; label: string };
  fields: Array<{ value: string; label: string }>;
  onFieldChange: (key: string) => void;
  operator: string;
  operators?: Array<{ value: string; label: string }>;
  onOperatorChange?: (operator: string) => void;
  value: React.ReactNode;
  valueEditor?: React.ReactNode;
  onRemove: () => void;
}) {
  const [valueOpen, setValueOpen] = React.useState(false);
  return (
    <div
      role="group"
      aria-label={`${field.label} filter`}
      className={cn(
        "inline-flex max-w-full items-stretch divide-x divide-border/60 overflow-hidden rounded-full dark:divide-white/[0.10]",
        toolbarControlStyles,
        toolbarControlSelectedStyles,
      )}
    >
      <SearchableSelect
        items={fields}
        value={field}
        getItemId={(item) => item.value}
        getItemLabel={(item) => item.label}
        onValueChange={(item) => {
          if (item) onFieldChange(item.value);
        }}
        searchPlaceholder="Search fields..."
        contentWidth="min(480px, 90vw)"
        trigger={
          <button
            type="button"
            title={field.label}
            aria-label={`Change field for ${field.label}`}
            className={filterSegmentClass}
          >
            <span className="max-w-56 truncate font-medium">{field.label}</span>
          </button>
        }
      />
      {operators && operators.length > 1 && onOperatorChange ? (
        <SearchableSelect
          items={operators}
          value={operators.find((item) => item.value === operator) ?? null}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          onValueChange={(item) => {
            if (item) onOperatorChange(item.value);
          }}
          searchPlaceholder="Search operators..."
          trigger={
            <button
              type="button"
              aria-label={`Change operator for ${field.label}`}
              className={filterSegmentClass}
            >
              {operators.find((item) => item.value === operator)?.label ??
                operator}
            </button>
          }
        />
      ) : (
        <span className={`${filterSegmentClass} text-muted-foreground`}>
          {operator}
        </span>
      )}
      {valueEditor ? (
        <Popover open={valueOpen} onOpenChange={setValueOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Change value for ${field.label}`}
              className={filterSegmentClass}
            >
              <span className="max-w-80 truncate">{value}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(320px,90vw)] p-0">
            {valueEditor}
          </PopoverContent>
        </Popover>
      ) : (
        value
      )}
      <button
        type="button"
        className={`${filterSegmentClass} px-2 text-muted-foreground`}
        onClick={onRemove}
        aria-label={`Remove filter for ${field.label}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function InlineFilterText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const previous = React.useRef(value);
  if (!editing)
    return (
      <button
        type="button"
        className={filterSegmentClass}
        aria-label={`Edit ${label}`}
        onClick={() => {
          previous.current = value;
          setEditing(true);
        }}
      >
        <span className="max-w-80 truncate">{value || "Enter text…"}</span>
      </button>
    );
  return (
    <Input
      autoFocus
      aria-label={label}
      value={value}
      placeholder="Enter text…"
      className="h-8 w-44 max-w-full rounded-none border-0 bg-transparent px-2.5 py-0 text-xs shadow-none focus-visible:ring-inset"
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setEditing(false);
        }
        if (event.key === "Escape") {
          onChange(previous.current);
          setEditing(false);
        }
      }}
    />
  );
}
