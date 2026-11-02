import { evidenceSchema, type Journey } from "./model";

export function parseBoard(data: unknown): Journey[] {
  const payload: unknown =
    typeof data === "string" ? (JSON.parse(data) as unknown) : data;
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected onboarding board payload");
  }
  return payload.map((row) => {
    if (!row || typeof row !== "object") {
      throw new Error("Unexpected onboarding journey");
    }
    const record = row as Record<string, unknown>;
    const { preferences, evidence, ...journey } = record;
    return {
      ...(journey as Journey),
      preferences: Array.isArray(preferences)
        ? (preferences as Journey["preferences"])
        : [],
      evidence: evidenceSchema.parse(evidence),
    };
  });
}
