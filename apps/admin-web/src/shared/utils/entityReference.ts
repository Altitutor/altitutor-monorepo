import type { JSONContent } from "@altitutor/ui";

export type EntityReference = { type: string; id: string; label: string };
/** References use the same persisted mention format as manually entered rich text. */
export function referenceDescription(reference: EntityReference): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "mention", attrs: reference },
          { type: "text", text: " " },
        ],
      },
    ],
  };
}
export function referenceKey(reference?: EntityReference | null) {
  return reference ? `${reference.type}:${reference.id}` : "";
}

/** Route a reference through the existing application navigation event boundary. */
export function openEntityReference(type: string, id: string) {
  window.dispatchEvent(new CustomEvent('mentionClick', { detail: { type, id } }));
}
