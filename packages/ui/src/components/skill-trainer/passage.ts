/** Split passage plain text into sentences (crude but sufficient for hit targets). */
export function splitPassageSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractPlainTextFromDoc(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join("");
}

export function hasProseMirrorContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false;
  const content = json.content;
  return Array.isArray(content) && content.length > 0;
}
