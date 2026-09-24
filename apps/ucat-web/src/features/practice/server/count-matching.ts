import type { SupabaseClient } from "@supabase/supabase-js";
import type { PracticeSelectionInput } from "@/features/practice/model/types";

type SectionRow = {
  id: string;
  section_number: number;
  time_per_question: number | null;
  number_of_questions: number | null;
};

const SECTION_KEY_TO_NUMBER: Record<string, number> = {
  verbal_reasoning: 1,
  decision_making: 2,
  quantitative_reasoning: 3,
  situational_judgement: 4,
};

/**
 * Computes the total number of questions matching the given filters.
 * Used by both the preview endpoint and the generate endpoint.
 */
export async function countMatchingQuestions(
  supabase: SupabaseClient,
  input: PracticeSelectionInput,
): Promise<{ totalMatchingQuestions: number }> {
  const sectionNumber = SECTION_KEY_TO_NUMBER[input.section];
  if (typeof sectionNumber !== "number") {
    return { totalMatchingQuestions: 0 };
  }

  const sectionNumbers = [sectionNumber];

  const { data: sections, error: sectionsError } = await supabase
    .from("vstudent_ucat_sections")
    .select("id,section_number,time_per_question,number_of_questions")
    .in("section_number", sectionNumbers);

  if (sectionsError || !sections?.length) {
    return { totalMatchingQuestions: 0 };
  }

  const sectionRows = sections as SectionRow[];
  const sectionIds = sectionRows.map((row) => row.id);

  const rpcClient = supabase as unknown as {
    rpc: (
      name: "count_student_ucat_practice_questions",
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc(
    "count_student_ucat_practice_questions",
    {
      p_section_id: sectionIds[0],
      p_category_ids: input.categoryIds?.length ? input.categoryIds : null,
      p_unanswered_only: input.unansweredOnly,
      p_incorrect_only: input.incorrectOnly,
    },
  );
  if (error) throw new Error(error.message);
  return { totalMatchingQuestions: typeof data === "number" ? data : 0 };
}
