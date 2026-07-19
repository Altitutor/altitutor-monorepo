type PublishedContentIssue = {
  message?: unknown;
};

const PUBLISHED_CONTENT_INVALID_PREFIX = "published_content_invalid:";

/**
 * Converts publication validation errors returned by Postgres into a message
 * suitable for question-stem save toasts. Other API errors pass through.
 */
export function humanizeQuestionStemError(rawMessage: string): string {
  const prefixIndex = rawMessage.indexOf(PUBLISHED_CONTENT_INVALID_PREFIX);
  if (prefixIndex === -1) return rawMessage;

  const serializedIssues = rawMessage.slice(
    prefixIndex + PUBLISHED_CONTENT_INVALID_PREFIX.length,
  );

  try {
    const parsed = JSON.parse(serializedIssues) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Expected an array of issues");

    const messages = Array.from(
      new Set(
        parsed
          .map((issue: PublishedContentIssue) =>
            typeof issue?.message === "string" ? issue.message.trim() : "",
          )
          .filter(Boolean),
      ),
    );

    if (messages.length > 0) {
      return `This published question stem still needs changes: ${messages.join(" ")}`;
    }
  } catch {
    // Never expose the raw database payload when it cannot be parsed.
  }

  return "This published question stem still needs changes before it can be saved.";
}
