export type QuestionEngineShortcutId =
  | "toggleCalculator"
  | "toggleFlagForReview"
  | "previousQuestion"
  | "openNavigator"
  | "nextQuestion"
  | "reviewScreen";

export type QuestionEngineShortcut = {
  id: QuestionEngineShortcutId;
  key: string;
  altKey?: boolean;
};

export const ANSWER_OPTION_SHORTCUT_KEYS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
] as const;

export type AnswerOptionShortcutKey =
  (typeof ANSWER_OPTION_SHORTCUT_KEYS)[number];

/**
 * Resolve A–F answer selection from the physical key (`event.code`).
 * iPadOS Option dead keys (e.g. Option+N → tilde) leave the next letter with a
 * composed `event.key` (`"ã"`, `"˜b"`) while `code` stays `KeyA` / `KeyB`.
 */
export function getAnswerOptionShortcutKey(
  event: Pick<KeyboardEvent, "code" | "altKey" | "ctrlKey" | "metaKey">,
): AnswerOptionShortcutKey | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  if (!event.code.startsWith("Key") || event.code.length !== 4) {
    return null;
  }
  const letter = event.code.slice(3).toLowerCase();
  return (ANSWER_OPTION_SHORTCUT_KEYS as readonly string[]).includes(letter)
    ? (letter as AnswerOptionShortcutKey)
    : null;
}

export const QUESTION_ENGINE_SHORTCUTS: QuestionEngineShortcut[] = [
  { id: "toggleCalculator", key: "c", altKey: true },
  { id: "toggleFlagForReview", key: "f", altKey: true },
  { id: "previousQuestion", key: "p", altKey: true },
  { id: "openNavigator", key: "v", altKey: true },
  { id: "nextQuestion", key: "n", altKey: true },
  { id: "reviewScreen", key: "s", altKey: true },
];

export const QUESTION_ENGINE_SHORTCUT_MAP: Record<
  string,
  QuestionEngineShortcutId
> = QUESTION_ENGINE_SHORTCUTS.reduce(
  (acc, shortcut) => {
    const parts = [];
    if (shortcut.altKey) parts.push("alt");
    parts.push(shortcut.key.toLowerCase());
    const key = parts.join("+");
    acc[key] = shortcut.id;
    return acc;
  },
  {} as Record<string, QuestionEngineShortcutId>,
);
