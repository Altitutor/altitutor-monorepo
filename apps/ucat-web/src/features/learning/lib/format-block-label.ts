import type { LearningModuleBlockRow } from "@/features/learning/types";

function collectNodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { text?: unknown; content?: unknown };
  if (typeof record.text === "string") return record.text;
  if (!Array.isArray(record.content)) return "";
  return record.content.map(collectNodeText).join("").trim();
}

function firstHeadingText(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as { type?: unknown; content?: unknown };
  if (record.type === "heading") {
    const text = collectNodeText(record);
    if (text) return text;
  }
  if (!Array.isArray(record.content)) return null;
  for (const child of record.content) {
    const heading = firstHeadingText(child);
    if (heading) return heading;
  }
  return null;
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function formatBlockLabel(block: LearningModuleBlockRow): string {
  if (block.block_type === "text") {
    const content = (block.content ?? {}) as { body?: unknown };
    const heading = firstHeadingText(content.body);
    if (heading) return heading;
  }
  const typeLabel = block.block_type?.replace(/_/g, " ") ?? "Block";
  return capitalise(typeLabel);
}
