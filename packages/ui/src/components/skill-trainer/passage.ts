import { extractSkillTrainerPlainText } from "@altitutor/shared";

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
  return extractSkillTrainerPlainText(doc);
}

export function extractPlainTextWithBlockBreaks(doc: Record<string, unknown> | null | undefined): string {
  return extractSkillTrainerPlainText(doc, { blockSeparator: "\n" });
}

export function hasProseMirrorContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== "object") return false;
  const content = json.content;
  return Array.isArray(content) && content.length > 0;
}
