import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparationEngineResult } from "@/features/preparation";

export async function persistPreparationProgression(
  admin: SupabaseClient<Database>,
  studentId: string,
  testYear: number,
  preparation: PreparationEngineResult,
): Promise<void> {
  const graduationEvents = preparation.progressionEvents.filter(
    (event) => event.type === "learning_graduated",
  );
  const rows = graduationEvents.map((event) => ({
    student_id: studentId,
    test_year: testYear,
    section_id: event.sectionId,
    learning_graduated_at: event.occurredAt,
    learning_graduation_route: event.route,
    policy_version: event.policyVersion,
    evidence_snapshot: {
      assessment: preparation.assessment.sections.find(
        (section) => section.sectionId === event.sectionId,
      ),
      score: preparation.currentScore.sections.find(
        (section) => section.sectionId === event.sectionId,
      ),
    },
  }));
  if (rows.length) {
    const { error } = await admin
      .from("ucat_student_preparation_section_states")
      .upsert(rows, {
        onConflict: "student_id,test_year,section_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  const timingEvents = preparation.progressionEvents.filter(
    (event) => event.type === "timing_pace_changed",
  );
  await Promise.all(
    timingEvents.map(async (event) => {
      const { error } = await admin
        .from("ucat_student_preparation_section_states")
        .update({
          prescribed_pace: event.toPace,
          prescribed_pace_set_at: event.occurredAt,
          pace_policy_version: event.policyVersion,
          timing_evidence_snapshot: {
            reason: event.reason,
            assessment: preparation.assessment.sections.find(
              (section) => section.sectionId === event.sectionId,
            ),
          },
        })
        .eq("student_id", studentId)
        .eq("test_year", testYear)
        .eq("section_id", event.sectionId);
      if (error) throw error;
    }),
  );
}
