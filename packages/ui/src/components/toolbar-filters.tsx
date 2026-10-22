"use client";

import * as React from "react";
import type {
  DataTableFilterDefinition,
  DataTableFilterOption,
} from "@altitutor/shared";
import { ToolbarSelectRow } from "./toolbar-select-row";
import { SearchableSelectInline } from "./searchable-select-inline";
import { DateRangeFilter } from "./date-range-filter";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import { Button } from "./button";
import {
  FilterPill,
  InlineFilterText,
  TEXT_FILTER_OPERATORS,
  CHOICE_FILTER_OPERATORS,
  type ToolbarConditionFilters,
  type ToolbarFilterCondition,
  type ToolbarFilterOperator,
} from "./toolbar-filter-pill";

export interface ToolbarFiltersProps {
  definitions: DataTableFilterDefinition[];
  filters: Record<string, unknown[]>;
  onChange: (filters: Record<string, unknown[]>) => void;
  conditions?: ToolbarConditionFilters;
  customContent?: Record<string, React.ReactNode>;
  onSearchChange?: (key: string, value: string) => void;
  persistenceKey: string;
  closeMenu: () => void;
  clearVersion?: number;
}

function definitionKeys(definition: DataTableFilterDefinition) {
  return [
    definition.key,
    definition.minKey,
    definition.maxKey,
    definition.fromKey,
    definition.toKey,
  ].filter((key): key is string => Boolean(key));
}

function filterSummary(
  definition: DataTableFilterDefinition,
  filters: Record<string, unknown[]>,
) {
  const values = filters[definition.key] ?? [];
  if (definition.type === "number-range" || definition.type === "date-range") {
    if (values.includes("__null__"))
      return definition.nullOptionLabel ?? "Empty";
    const from = filters[definition.minKey ?? definition.fromKey ?? ""]?.[0];
    const to = filters[definition.maxKey ?? definition.toKey ?? ""]?.[0];
    if ((from == null || from === "") && (to == null || to === "")) return "";
    return [
      from == null || from === "" ? "Any" : String(from),
      to == null || to === "" ? "Any" : String(to),
    ].join(" – ");
  }
  return values
    .map(
      (value) =>
        definition.options?.find(
          (option) => String(option.value) === String(value),
        )?.label ??
        (typeof value === "object" ? "Custom value" : String(value)),
    )
    .join(", ");
}

function FilterValueEditor({
  definition,
  ...props
}: ToolbarFiltersProps & { definition: DataTableFilterDefinition }) {
  const { filters, onChange, customContent, onSearchChange } = props;
  if (customContent?.[definition.key] != null)
    return <>{customContent[definition.key]}</>;
  const setValue = (key: string, value: unknown) => {
    const next = { ...filters };
    if (value == null || value === "") delete next[key];
    else next[key] = [value];
    onChange(next);
  };
  if (
    definition.type === "date-range" &&
    definition.fromKey &&
    definition.toKey
  ) {
    return (
      <DateRangeFilter
        fromValue={String(filters[definition.fromKey]?.[0] ?? "")}
        toValue={String(filters[definition.toKey]?.[0] ?? "")}
        onFromChange={(value) => setValue(definition.fromKey!, value)}
        onToChange={(value) => setValue(definition.toKey!, value)}
        onRangeChange={(from, to) => {
          const next = { ...filters };
          if (from) next[definition.fromKey!] = [from];
          else delete next[definition.fromKey!];
          if (to) next[definition.toKey!] = [to];
          else delete next[definition.toKey!];
          onChange(next);
        }}
      />
    );
  }
  if (
    definition.type === "number-range" &&
    definition.minKey &&
    definition.maxKey
  ) {
    return (
      <div className="space-y-3 p-3">
        {definition.nullOptionLabel ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={(filters[definition.key] ?? []).includes("__null__")}
              onCheckedChange={(checked) =>
                setValue(definition.key, checked ? "__null__" : null)
              }
            />
            {definition.nullOptionLabel}
          </label>
        ) : null}
        <div className="flex gap-2">
          {[
            { key: definition.minKey, label: "Min" },
            { key: definition.maxKey, label: "Max" },
          ].map(({ key, label }) => (
            <label key={key} className="min-w-0 flex-1 space-y-1 text-xs">
              {label}
              <Input
                type="number"
                aria-label={`${definition.label} ${label.toLowerCase()}`}
                value={String(filters[key]?.[0] ?? "")}
                onChange={(event) =>
                  setValue(
                    key,
                    event.target.value === ""
                      ? null
                      : Number.isFinite(Number(event.target.value))
                        ? Number(event.target.value)
                        : null,
                  )
                }
              />
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (definition.type === "date")
    return (
      <Input
        type="date"
        aria-label={definition.label}
        value={String(filters[definition.key]?.[0] ?? "")}
        onChange={(event) => setValue(definition.key, event.target.value)}
      />
    );
  const options = definition.options ?? [];
  return (
    <SearchableSelectInline<DataTableFilterOption>
      items={options}
      value={options.filter((option) =>
        (filters[definition.key] ?? []).some(
          (value) => String(value) === String(option.value),
        ),
      )}
      onValueChange={(selected) => {
        const next = { ...filters };
        if (selected.length)
          next[definition.key] = selected.map((option) => option.value);
        else delete next[definition.key];
        onChange(next);
      }}
      getItemId={(option) => String(option.value)}
      getItemLabel={(option) => option.label}
      searchPlaceholder={
        definition.searchPlaceholder ??
        `Search ${definition.label.toLowerCase()}...`
      }
      multiSelect
      onSearchChange={
        definition.searchable && onSearchChange
          ? (query) => onSearchChange(definition.key, query)
          : undefined
      }
    />
  );
}

function updateCondition(
  conditions: ToolbarConditionFilters,
  value: ToolbarFilterCondition,
) {
  const existing = conditions.value.some(
    (condition) => condition.fieldKey === value.fieldKey,
  );
  conditions.onChange(
    existing
      ? conditions.value.map((condition) =>
          condition.fieldKey === value.fieldKey ? value : condition,
        )
      : [...conditions.value, value],
  );
}

function ChoiceConditionEditor({
  field,
  condition,
  conditions,
}: {
  field: ToolbarConditionFilters["fields"][number];
  condition?: ToolbarFilterCondition;
  conditions: ToolbarConditionFilters;
}) {
  const options = field.options ?? [];
  return (
    <SearchableSelectInline<DataTableFilterOption<string>>
      items={options}
      value={options.filter((option) =>
        condition?.values.includes(option.value),
      )}
      onValueChange={(selected) =>
        updateCondition(conditions, {
          fieldKey: field.key,
          operator: condition?.operator ?? "any",
          values: selected.map((option) => option.value),
        })
      }
      getItemId={(option) => option.value}
      getItemLabel={(option) => option.label}
      searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
      multiSelect
    />
  );
}

export function ToolbarFiltersMenu(props: ToolbarFiltersProps) {
  return (
    <>
      {props.definitions
        .filter((definition) => definition.filterable !== false)
        .map((definition) => (
          <ToolbarSelectRow
            key={definition.key}
            label={definition.label}
            summary={filterSummary(definition, props.filters)}
            persistenceKey={`${props.persistenceKey}:${definition.key}`}
          >
            <FilterValueEditor {...props} definition={definition} />
          </ToolbarSelectRow>
        ))}
      {props.conditions?.fields.length ? (
        <p className="pt-3 pb-1 text-xs font-medium text-muted-foreground">
          Question answers
        </p>
      ) : null}
      {props.conditions?.fields.map((field) => {
        const condition = props.conditions!.value.find(
          (item) => item.fieldKey === field.key,
        );
        return field.type === "text" ? (
          <div
            key={field.key}
            className="flex items-center justify-between gap-4 py-1.5"
          >
            <span className="min-w-0 text-sm text-muted-foreground">
              {field.label}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Filter ${field.label}`}
              onClick={() => {
                updateCondition(
                  props.conditions!,
                  condition ?? {
                    fieldKey: field.key,
                    operator: "contains",
                    values: [],
                  },
                );
                props.closeMenu();
              }}
            >
              {condition?.values[0] || "Enter text…"}
            </Button>
          </div>
        ) : (
          <ToolbarSelectRow
            key={field.key}
            label={field.label}
            summary={condition?.values
              .map(
                (value) =>
                  field.options?.find((option) => option.value === value)
                    ?.label ?? "Unavailable choice",
              )
              .join(", ")}
            persistenceKey={`${props.persistenceKey}:question:${field.key}`}
          >
            <ChoiceConditionEditor
              field={field}
              condition={condition}
              conditions={props.conditions!}
            />
          </ToolbarSelectRow>
        );
      })}
    </>
  );
}

export function ToolbarFilterPills(
  props: ToolbarFiltersProps & {
    showDeletedActive?: boolean;
    clearDeleted?: () => void;
  },
) {
  const [draftField, setDraftField] = React.useState<string | null>(null);
  React.useEffect(() => {
    setDraftField(null);
  }, [props.clearVersion]);
  const nodes: React.ReactElement[] = [];
  const definitions = props.definitions.filter(
    (definition) => definition.filterable !== false,
  );
  const remove = (definition: DataTableFilterDefinition) => {
    const next = { ...props.filters };
    definitionKeys(definition).forEach((key) => delete next[key]);
    return next;
  };
  for (const definition of definitions) {
    if (
      draftField !== definition.key &&
      !definitionKeys(definition).some((key) => props.filters[key]?.length)
    )
      continue;
    const operator =
      definition.type === "date-range" || definition.type === "number-range"
        ? "between"
        : definition.type === "date"
          ? "is"
          : "contains any";
    nodes.push(
      <FilterPill
        key={definition.key}
        field={{ value: definition.key, label: definition.label }}
        fields={definitions
          .filter(
            (other) =>
              other.key === definition.key ||
              !definitionKeys(other).some((key) => props.filters[key]?.length),
          )
          .map((other) => ({ value: other.key, label: other.label }))}
        onFieldChange={(key) => {
          if (key === definition.key) return;
          const target = definitions.find((other) => other.key === key);
          const next = remove(definition);
          setDraftField(key);
          // Preserve valid selections when moving between choice fields; ranges keep their own units.
          if (target && !definition.type && !target.type) {
            const values = (props.filters[definition.key] ?? []).filter(
              (value) =>
                target.options?.some(
                  (option) => String(option.value) === String(value),
                ),
            );
            if (values.length) next[key] = values;
          }
          props.onChange(next);
        }}
        operator={operator}
        value={filterSummary(definition, props.filters) || "Select values…"}
        valueEditor={<FilterValueEditor {...props} definition={definition} />}
        onRemove={() => {
          setDraftField(null);
          props.onChange(remove(definition));
        }}
      />,
    );
  }
  const conditions = props.conditions;
  for (const condition of conditions?.value ?? []) {
    const field = conditions!.fields.find(
      (item) => item.key === condition.fieldKey,
    );
    const update = (next: ToolbarFilterCondition) =>
      conditions!.onChange(
        conditions!.value.map((item) =>
          item.fieldKey === condition.fieldKey ? next : item,
        ),
      );
    const operators =
      field?.type === "text" ? TEXT_FILTER_OPERATORS : CHOICE_FILTER_OPERATORS;
    nodes.push(
      <FilterPill
        key={`condition:${condition.fieldKey}`}
        field={{
          value: condition.fieldKey,
          label: field?.label ?? "Unavailable question",
        }}
        fields={conditions!.fields
          .filter(
            (item) =>
              item.key === condition.fieldKey ||
              !conditions!.value.some((other) => other.fieldKey === item.key),
          )
          .map((item) => ({ value: item.key, label: item.label }))}
        onFieldChange={(key) => {
          if (key === condition.fieldKey) return;
          const target = conditions!.fields.find((item) => item.key === key);
          update({
            fieldKey: key,
            operator: target?.type === "text" ? "contains" : "any",
            values: [],
          });
        }}
        operator={condition.operator}
        operators={operators}
        onOperatorChange={(operator) =>
          update({ ...condition, operator: operator as ToolbarFilterOperator })
        }
        value={
          field?.type === "text" ? (
            <InlineFilterText
              key={condition.fieldKey}
              label={`${field.label} ${operators.find((item) => item.value === condition.operator)?.label ?? "contains"}`}
              value={condition.values[0] ?? ""}
              onChange={(value) => update({ ...condition, values: [value] })}
            />
          ) : (
            condition.values
              .map(
                (value) =>
                  field?.options?.find((option) => option.value === value)
                    ?.label ?? "Unavailable choice",
              )
              .join(", ") || "Select values…"
          )
        }
        valueEditor={
          field?.type === "choice" ? (
            <ChoiceConditionEditor
              field={field}
              condition={condition}
              conditions={conditions!}
            />
          ) : undefined
        }
        onRemove={() =>
          conditions!.onChange(
            conditions!.value.filter(
              (item) => item.fieldKey !== condition.fieldKey,
            ),
          )
        }
      />,
    );
  }
  if (props.showDeletedActive)
    nodes.push(
      <div
        key="deleted"
        className="inline-flex items-center rounded-full border px-3 text-xs"
      >
        Show deleted
        <Button
          size="sm"
          variant="ghost"
          aria-label="Clear show deleted"
          onClick={props.clearDeleted}
        >
          ×
        </Button>
      </div>,
    );
  if (!nodes.length) return null;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      aria-label="Active filters"
    >
      {nodes.map((node, index) => (
        <React.Fragment key={node.key}>
          {index ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              AND
            </span>
          ) : null}
          {node}
        </React.Fragment>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          setDraftField(null);
          props.onChange({});
          conditions?.onChange([]);
          props.clearDeleted?.();
        }}
      >
        Clear filters
      </Button>
    </div>
  );
}
