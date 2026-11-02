export const STATION_NAME_INSTRUCTION =
  "Provide a concise name for this MMI station.";

export const STATION_NAME_SYSTEM =
  'Reply with JSON only: {"name":"a concise MMI station name"}. Use a few words, at most 80 characters, and do not include a station number.';

export const QUESTION_TAGS_SYSTEM =
  'Reply with JSON only: {"tagIds":["id"]}. Select the appropriate tags for the question from the supplied list. Use only those ids. Return an empty array when none apply.';

const NAME_LIMIT = 80;

export function buildStationNamePrompt(
  prompt: string,
  questions: string[],
): string {
  const listed = questions
    .map((question) => question.trim())
    .filter(Boolean)
    .map((question, index) => `${index + 1}. ${question}`);
  return [
    STATION_NAME_INSTRUCTION,
    "",
    "Prompt:",
    prompt.trim() || "(none)",
    "",
    "Questions:",
    listed.length ? listed.join("\n") : "(none)",
  ].join("\n");
}

export function buildQuestionTagsPrompt(
  prompt: string,
  question: string,
  tags: Array<{ id: string; name: string }>,
): string {
  return [
    "Select the appropriate tags for this question. The station prompt is context.",
    "",
    "Prompt:",
    prompt.trim() || "(none)",
    "",
    "Question:",
    question.trim(),
    "",
    "Tags:",
    tags.map((tag) => `${tag.id} ${tag.name}`).join("\n"),
  ].join("\n");
}

export function readStationName(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const name = (parsed as { name?: unknown }).name;
  if (typeof name !== "string") return null;
  const cleaned = name.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
  if (!cleaned) return null;
  if (cleaned.length <= NAME_LIMIT) return cleaned;
  const shortened = cleaned.slice(0, NAME_LIMIT + 1);
  const boundary = shortened.lastIndexOf(" ");
  return (boundary > 40 ? shortened.slice(0, boundary) : cleaned.slice(0, NAME_LIMIT)).trim();
}

export function readSelectedTagIds(
  parsed: unknown,
  tags: Array<{ id: string; name: string }>,
): string[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const record = parsed as { tagIds?: unknown; tags?: unknown };
  const raw = Array.isArray(record.tagIds)
    ? record.tagIds
    : Array.isArray(record.tags)
      ? record.tags
      : [];
  const ids = new Set(tags.map((tag) => tag.id));
  const byName = new Map(tags.map((tag) => [tag.name.trim().toLowerCase(), tag.id]));
  const selected: string[] = [];
  for (const item of raw) {
    const value =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "id" in item && typeof item.id === "string"
          ? item.id
          : item && typeof item === "object" && "name" in item && typeof item.name === "string"
            ? item.name
            : "";
    const trimmed = value.trim();
    const id = ids.has(trimmed) ? trimmed : byName.get(trimmed.toLowerCase());
    if (id && !selected.includes(id)) selected.push(id);
  }
  return selected;
}
