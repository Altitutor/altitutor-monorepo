import type { Json } from "@altitutor/shared";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";

export function getQuestionSetLabel(name: Json | null): string {
  return extractTextFromRichJson(name as JsonLike).trim() || "Question set";
}
