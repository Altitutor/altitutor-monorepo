type DurationBlock = {
  blockType: string | null;
  content: unknown;
  questionId: string | null;
  questionStemId: string | null;
  skillTrainerId: string | null;
  fileId: string | null;
};

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFrom).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(textFrom).join(" ");
  }
  return "";
}

function numericDuration(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["duration_seconds", "durationSeconds", "video_duration_seconds"]) {
    const candidate = record[key];
    if (typeof candidate === "number" && candidate > 0) return candidate;
  }
  for (const child of Object.values(record)) {
    const nested = numericDuration(child);
    if (nested != null) return nested;
  }
  return null;
}

export function estimateLearningModuleMinutes(blocks: DurationBlock[]): number {
  const rawMinutes = blocks.reduce((total, block) => {
    const type = block.blockType ?? "";
    if (block.fileId && !block.content) return total;
    if (block.skillTrainerId || type.includes("skill")) return total + 8;
    if (block.questionId || block.questionStemId || type.includes("question")) {
      return total + 4;
    }
    if (type.includes("video")) {
      return total + Math.max(3, Math.ceil((numericDuration(block.content) ?? 300) / 60));
    }
    const words = textFrom(block.content).trim().split(/\s+/).filter(Boolean).length;
    return total + Math.max(2, Math.ceil(words / 180) + 1);
  }, 0);

  return Math.max(5, Math.ceil(rawMinutes / 5) * 5);
}
