const fatalCategories = new Set([
  "ejected",
  "nbf-room",
  "nbf-token",
  "exp-room",
  "exp-token",
  "no-room",
  "meeting-full",
  "end-of-life",
  "not-allowed",
  "connection-error",
]);

/** Temporary localhost evidence for DEV-241; never include provider messages or IDs. */
export function reportLocalCallFailure(
  category: unknown,
  state: "joined" | "joining" | "obsolete",
) {
  if (process.env.NODE_ENV !== "development") return;
  try {
    console.warn("[Interview media] Local call failure", {
      category:
        typeof category === "string" && fatalCategories.has(category)
          ? category
          : "unclassified",
      state,
    });
  } catch {
    // Diagnostics must not interrupt the existing recovery path.
  }
}
