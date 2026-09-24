function field(error: unknown, key: "code" | "message" | "status"): unknown {
  return error && typeof error === "object" && key in error
    ? (error as Record<string, unknown>)[key]
    : null;
}

export function isTransientSupabaseError(error: unknown): boolean {
  const code = String(field(error, "code") ?? "");
  const status = Number(field(error, "status"));
  const message = String(
    field(error, "message") ?? (error instanceof Error ? error.message : ""),
  ).toLowerCase();

  return (
    code === "57014" ||
    code === "08000" ||
    code.startsWith("08") ||
    status === 429 ||
    status >= 500 ||
    message.includes("statement timeout") ||
    message.includes("timed out") ||
    message.includes("deadline exceeded") ||
    message.includes("context canceled") ||
    message.includes("fetch failed") ||
    message.includes("connection terminated")
  );
}
