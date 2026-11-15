import type { Note } from "../types";

export type DocumentOrder = {
  field: "title" | "updated_at";
  direction: "asc" | "desc";
};

export const defaultDocumentOrder: DocumentOrder = { field: "title", direction: "asc" };

export function sortDocuments(notes: Note[], order: DocumentOrder) {
  return [...notes].sort((a, b) => {
    const titleOrder = (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
    const result = order.field === "updated_at"
      ? Date.parse(a.updated_at) - Date.parse(b.updated_at) || titleOrder
      : titleOrder;
    return order.direction === "asc" ? result : -result;
  });
}
