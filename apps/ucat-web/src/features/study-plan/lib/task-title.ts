import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

export function preferredCatalogAssetName(input: {
  displayName: string | null | undefined;
  richName: JsonLike;
  fallback: string;
}): string {
  return (
    input.displayName?.trim() ||
    extractTextFromRichJson(input.richName).trim() ||
    input.fallback
  );
}

export function scheduledAssetTaskTitle(input: {
  taskType: StudyPlanTask["taskType"];
  storedTitle: string;
  assetName: string | null;
  repeated: boolean;
}): string {
  if (!input.assetName) return input.storedTitle;
  const assetTitle = `${input.repeated ? "Repeat benchmark · " : ""}${input.assetName}`;
  if (input.taskType === "section_benchmark" || input.taskType === "mock") {
    return assetTitle;
  }
  if (input.taskType === "review") return `Review · ${assetTitle}`;
  return input.storedTitle;
}
