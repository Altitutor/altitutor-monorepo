import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RemediationCatalog,
  RemediationCatalogLesson,
} from "../lib/remediation-learning-modules";

type StudentClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const EMPTY_CATALOG: RemediationCatalog = {
  lessons: [],
  tagTaxonomy: [],
};

export async function fetchRemediationCatalog(
  supabase: StudentClient,
): Promise<RemediationCatalog> {
  if (!supabaseAdmin) return EMPTY_CATALOG;

  const [modulesRes, categoriesRes, tagsRes, taxonomyRes] = await Promise.all([
    supabase
      .from("vstudent_ucat_learning_modules")
      .select(
        "id, title, kind, section_number, ucat_section_id, study_plan_priority",
      ),
    supabaseAdmin
      .from("ucat_learning_module_question_stem_categories")
      .select("learning_module_id, question_stem_category_id"),
    supabaseAdmin
      .from("ucat_learning_module_question_tags")
      .select("learning_module_id, question_tag_id"),
    supabaseAdmin.from("question_tags").select("id, parent_question_tag_id"),
  ]);

  if (modulesRes.error) return EMPTY_CATALOG;

  const categoryIdsByModule = new Map<string, string[]>();
  for (const row of categoriesRes.data ?? []) {
    if (!row.learning_module_id || !row.question_stem_category_id) continue;
    categoryIdsByModule.set(row.learning_module_id, [
      ...(categoryIdsByModule.get(row.learning_module_id) ?? []),
      row.question_stem_category_id,
    ]);
  }

  const tagIdsByModule = new Map<string, string[]>();
  for (const row of tagsRes.data ?? []) {
    if (!row.learning_module_id || !row.question_tag_id) continue;
    tagIdsByModule.set(row.learning_module_id, [
      ...(tagIdsByModule.get(row.learning_module_id) ?? []),
      row.question_tag_id,
    ]);
  }

  const lessons: RemediationCatalogLesson[] = (modulesRes.data ?? []).flatMap(
    (row) => {
      if (!row.id || !row.title || row.kind !== "lesson") return [];
      const studyPlanPriority = row.study_plan_priority;
      if (
        studyPlanPriority !== "essential" &&
        studyPlanPriority !== "recommended" &&
        studyPlanPriority !== "optional" &&
        studyPlanPriority !== "excluded"
      ) {
        return [];
      }
      return [
        {
          id: row.id,
          title: row.title,
          sectionId: row.ucat_section_id,
          sectionNumber: row.section_number,
          studyPlanPriority,
          categoryIds: categoryIdsByModule.get(row.id) ?? [],
          authoredQuestionTagIds: tagIdsByModule.get(row.id) ?? [],
        },
      ];
    },
  );

  return {
    lessons,
    tagTaxonomy: (taxonomyRes.data ?? []).flatMap((row) =>
      row.id
        ? [
            {
              id: row.id,
              parent_question_tag_id: row.parent_question_tag_id ?? null,
            },
          ]
        : [],
    ),
  };
}
