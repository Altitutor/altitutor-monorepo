import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import { pickStems } from "@/app/api/ucat/generated-sets/pick-stems";
import {
  mapStemDetailToQuestionStemWithQuestions,
  type StemDetailRowFromDb,
} from "@/features/practice/lib/map-stem-detail-for-practice";
import {
  checkPracticeStartQuota,
  getPracticeQuotaStatusForStudent,
} from "@/lib/ucat/quota/quota-service";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";

export class PracticeStemSelectionError extends Error {}

export async function preparePracticeStems({
  reader,
  admin,
  studentId,
  input,
}: {
  reader: SupabaseClient;
  admin: SupabaseClient;
  studentId: string;
  input: SetGeneratorInput;
}): Promise<{
  stems: QuestionStemWithQuestions[];
  questionCount: number;
  totalMatchingQuestions: number;
}> {
  const quotaStatus = await getPracticeQuotaStatusForStudent(admin, studentId);
  const enforcePracticeQuota =
    quotaStatus != null && !quotaStatus.isQuotaExempt;
  const result = await pickStems(reader, input, {
    allowOversizedFallback: !enforcePracticeQuota,
  });
  if (result.chosenStemIds.length === 0) {
    throw new PracticeStemSelectionError(
      "No question stems match these filters.",
    );
  }

  const { data, error } = await reader
    .from("vstudent_ucat_question_stem_detail")
    .select("id,section_name,display_columns,stem_text,questions")
    .in("id", result.chosenStemIds);
  if (error || !data?.length) {
    throw new Error(error?.message ?? "Failed to load stem details");
  }

  const rows = data as StemDetailRowFromDb[];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const stems = result.chosenStemIds
    .map((id) => rowById.get(id))
    .filter((row): row is StemDetailRowFromDb => row != null)
    .map((row) => mapStemDetailToQuestionStemWithQuestions(row));
  const questionIds = stems.flatMap((stem) =>
    stem.questions.map((question) => question.id),
  );
  const quotaCheck = await checkPracticeStartQuota(
    admin,
    studentId,
    questionIds,
  );
  if (!quotaCheck.allowed) {
    throw new QuotaExceededError(quotaCheck.payload);
  }

  return {
    stems,
    questionCount: result.questionCount,
    totalMatchingQuestions: result.totalMatchingQuestions,
  };
}
