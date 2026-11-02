export type ChoiceFilterMode = "any" | "all" | "none";
export function choiceFilterMatches(
  selected: unknown[],
  actual: unknown,
  mode: unknown = "any",
): boolean {
  if (!selected.length) return true;
  const values = Array.isArray(actual) ? actual : [actual];
  const matches = (value: unknown) => values.includes(value);
  return mode === "all"
    ? selected.every(matches)
    : mode === "none"
      ? !selected.some(matches)
      : selected.some(matches);
}

/** Metadata describes a filter; it must never become a database column predicate. */
export function isFilterMetadata(key: string): boolean {
  return key.endsWith("__operator") || key.endsWith("__anchor");
}

/** Fetch a superset for client-side matching; also share cache entries for empty searches. */
export function filterQueryCandidates<T extends object>(
  filters?: T,
): T | undefined {
  if (!filters) return undefined;
  const values = filters as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        !isFilterMetadata(key) &&
        !(
          Array.isArray(values[`${key}__operator`]) &&
          (values[`${key}__operator`] as unknown[])[0] === "none"
        ) &&
        value !== undefined &&
        !(key === "search" && value === ""),
    ),
  ) as T;
}

export const DATE_FILTER_OPERATORS = [
  { value: "between", label: "between" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "on", label: "on" },
  { value: "on_or_after", label: "on or after" },
  { value: "on_or_before", label: "on or before" },
];
export function dateFilterBounds(
  operator: string,
  anchor: string,
): { from?: string; to?: string } {
  if (!anchor) return {};
  const shift = (days: number) => {
    const date = new Date(anchor.slice(0, 10) + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return anchor;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  switch (operator) {
    case "before":
      return { to: shift(-1) };
    case "after":
      return { from: shift(1) };
    case "on":
      return { from: anchor, to: anchor };
    case "on_or_before":
      return { to: anchor };
    default:
      return { from: anchor };
  }
}

/** Date-only filters refer to a whole local calendar day, including timestamped records. */
export function calendarDateBound(
  value: string,
  edge: "start" | "end",
): string {
  return value.length === 10
    ? new Date(
        value + (edge === "start" ? "T00:00:00" : "T23:59:59.999"),
      ).toISOString()
    : value;
}
