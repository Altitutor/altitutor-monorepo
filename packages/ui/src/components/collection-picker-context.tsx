"use client";
import { createContext, useContext, type ReactNode } from "react";

export type CollectionActionKey = "s" | "p" | "a" | "d" | "e";
export const CollectionPickerContext = createContext<{
  field: string;
  triggerLabel?: string;
  compact?: boolean;
  select?: (id: string | null) => Promise<boolean>;
  busy?: boolean;
  container?: () => HTMLElement | null;
  error?: string | null;
} | null>(null);
export function collectionActionKey(
  field: string,
): CollectionActionKey | undefined {
  if (field === "status" || field === "s") return "s";
  if (field === "priority" || field === "p") return "p";
  if (["due_date", "target_date", "dueDate", "targetDate", "d"].includes(field)) return "d";
  if (["estimate", "e"].includes(field)) return "e";
  if (["assignee", "lead", "assigned_to", "a"].includes(field)) return "a";
}
/** Native row/card pickers retain their own callbacks unless a bulk selection owns them. */
export function CollectionField({
  field,
  children,
}: {
  field: string;
  children: ReactNode;
}) {
  const parent = useContext(CollectionPickerContext);
  const key = collectionActionKey(field);
  return (
    <CollectionPickerContext.Provider
      value={key ? { ...parent, field } : parent}
    >
      <div className="contents" data-collection-field={key}>
        {children}
      </div>
    </CollectionPickerContext.Provider>
  );
}
