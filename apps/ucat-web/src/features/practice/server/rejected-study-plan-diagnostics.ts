import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = new Set([
  "planned",
  "partial",
  "in_progress",
  "completed",
  "skipped",
]);
const TYPES = new Set([
  "learn",
  "practice",
  "section_benchmark",
  "mock",
  "skill_trainer",
  "review",
]);
const DIAGNOSTIC_TIMEOUT_MS = 1000;

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value)
    ? value.toLowerCase()
    : null;
}

type Diagnostics = {
  observation: "after_insert_failure";
  student_id: string | null;
  task_id: string | null;
  section_id: string | null;
  task_lookup: "not_attempted" | "found" | "not_found_or_not_owned" | "failed";
  task_status?: string | null;
  task_type?: string | null;
  task_section_matches?: boolean;
  generation_id?: string | null;
  generation_lookup?: "found" | "not_found_or_not_owned" | "failed";
  generation_superseded?: boolean;
};

/**
 * Enrich an existing rejected-start event; never change authorization or retry
 * the insert. Reads are owner-scoped, bounded and explicitly post-failure:
 * concurrent maintenance may change state between the rejection and observation.
 * No request body, task titles, auth values or arbitrary error strings are copied.
 */
export async function getRejectedStudyPlanDiagnostics(
  admin: SupabaseClient<Database>,
  input: { studentId: string; taskId: unknown; sectionId: unknown },
): Promise<Diagnostics> {
  const context: Diagnostics = {
    observation: "after_insert_failure",
    student_id: uuid(input.studentId),
    task_id: uuid(input.taskId),
    section_id: uuid(input.sectionId),
    task_lookup: "not_attempted",
  };
  if (!context.student_id || !context.task_id) return context;
  const studentId = context.student_id;
  const taskId = context.task_id;

  return Sentry.withScope(async (scope) => {
    // The admin SDK reports database failures before callers can catch them.
    // These best-effort reads only enrich the original rejection, captured by
    // the caller after this async scope exits; other requests keep their scopes.
    // The SDK attaches its Supabase context before processing, but adds the
    // auto.db.supabase.postgres mechanism in a later child-scope processor.
    scope.addEventProcessor((event) =>
      event.contexts?.supabase ? null : event,
    );
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("Diagnostic observation timed out"));
      }, DIAGNOSTIC_TIMEOUT_MS);
    });

    try {
      const { data: task, error } = await Promise.race([
        admin
          .from("ucat_student_study_plan_tasks")
          .select("id,status,task_type,section_id,generation_id")
          .eq("id", taskId)
          .eq("student_id", studentId)
          .abortSignal(controller.signal)
          .maybeSingle(),
        expired,
      ]);
      if (error) {
        context.task_lookup = "failed";
        return context;
      }
      if (!task) {
        context.task_lookup = "not_found_or_not_owned";
        return context;
      }
      context.task_lookup = "found";
      context.task_status = STATES.has(task.status) ? task.status : null;
      context.task_type = TYPES.has(task.task_type) ? task.task_type : null;
      if (context.section_id && uuid(task.section_id)) {
        context.task_section_matches =
          uuid(task.section_id) === context.section_id;
      }
      context.generation_id = uuid(task.generation_id);
      if (!context.generation_id) return context;

      try {
        const { data: generation, error: generationError } = await Promise.race(
          [
            admin
              .from("ucat_student_study_plan_generations")
              .select("superseded_at")
              .eq("id", context.generation_id)
              .eq("student_id", studentId)
              .abortSignal(controller.signal)
              .maybeSingle(),
            expired,
          ],
        );
        context.generation_lookup = generationError
          ? "failed"
          : generation
            ? "found"
            : "not_found_or_not_owned";
        if (generation)
          context.generation_superseded = generation.superseded_at !== null;
      } catch {
        context.generation_lookup = "failed";
      }
    } catch {
      context.task_lookup = "failed";
    } finally {
      clearTimeout(timeout);
    }
    return context;
  });
}
