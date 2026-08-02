import { extractSkillTrainerPlainText } from "@altitutor/shared";

/** Split passage plain text into sentences (crude but sufficient for hit targets). */
export function splitPassageSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  let sentenceStart = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    if (
      (trimmed[index] === "." ||
        trimmed[index] === "!" ||
        trimmed[index] === "?") &&
      /\s/.test(trimmed[index + 1] ?? "")
    ) {
      sentences.push(trimmed.slice(sentenceStart, index + 1).trim());
      sentenceStart = index + 1;
    }
  }

  const remainder = trimmed.slice(sentenceStart).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
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
