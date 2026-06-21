export type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

export function extractTextFromRichJson(value: JsonLike): string {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(extractTextFromRichJson)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const record = value as { [key: string]: JsonLike };

  // Skip image nodes - they have no meaningful text; returning attrs would produce "image https://..."
  if (record.type === "image") {
    return "";
  }

  if (Array.isArray(record.content)) {
    return record.content
      .map(extractTextFromRichJson)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (typeof record.text === "string") {
    return record.text;
  }

  return Object.values(record)
    .map(extractTextFromRichJson)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export type MappedRichExplanation = {
  text?: string;
  json?: Record<string, unknown> | null;
};

/** Maps a Tiptap/ProseMirror explanation field to plain text and JSON for rendering. */
export function mapRichExplanation(value: unknown): MappedRichExplanation {
  if (value == null) {
    return {};
  }

  const json =
    typeof value === "object" ? (value as Record<string, unknown>) : null;
  const rawText = extractTextFromRichJson(value as JsonLike)?.trim() ?? "";
  const text =
    rawText.toLowerCase() === "paragraph" ? "" : rawText;

  if (!text && !json) {
    return {};
  }

  return {
    text: text || undefined,
    json,
  };
}

export function hasRichExplanation(
  item: MappedRichExplanation | undefined | null,
): boolean {
  return Boolean(item?.text || item?.json);
}
