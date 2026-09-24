export function formatReviewValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(formatReviewValue).join(" ");
  return "Not recorded";
}

export function reviewAnswerLabels(
  trainerKey: string,
  item: {
    content: Record<string, unknown>;
    answer: unknown;
    correct: boolean;
  },
): { yours: string; correct: string } {
  const content = item.content;
  if (trainerKey === "find_word") {
    const keywords = Array.isArray(content.keywords)
      ? content.keywords
          .filter((value): value is { text: string } =>
            Boolean(value && typeof value === "object" && "text" in value),
          )
          .map((value) => value.text)
      : [];
    return {
      yours: item.correct
        ? "All keywords placed"
        : formatReviewValue(item.answer),
      correct: keywords.join(", ") || "Not recorded",
    };
  }
  if (trainerKey === "find_concept") {
    const count = Array.isArray(content.occurrences)
      ? content.occurrences.length
      : 0;
    return {
      yours: item.correct
        ? "All occurrences found"
        : "Skipped before finding all occurrences",
      correct: `${count} occurrence${count === 1 ? "" : "s"}`,
    };
  }
  return {
    yours: formatReviewValue(item.answer),
    correct: formatReviewValue(content.button_sequence ?? content.answer),
  };
}
