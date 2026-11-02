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
type Lookup = "not_attempted" | "found" | "not_found_or_not_owned" | "failed";
type Input = { studentId: string; taskId: unknown } & (
  | { operation: "practice"; sectionId: unknown }
  | { operation: "learning"; moduleId: unknown }
);
type Diagnostics = {
  observation: "after_insert_failure" | "after_start_failure";
  operation: "practice" | "learning";
  observed_at: string;
  elapsed_ms: number;
  student_id: string | null;
  task_id: string | null;
  section_id?: string | null;
  module_id?: string | null;
  task_lookup: Lookup;
  task_owner_matches?: boolean;
  task_identity_matches?: boolean;
  task_status?: string | null;
  task_type?: string | null;
  task_terminal?: boolean;
  task_type_matches?: boolean;
  task_section_matches?: boolean;
  task_module_matches?: boolean;
  task_updated_at?: string | null;
  task_started_at?: string | null;
  task_completed_at?: string | null;
  task_skipped_at?: string | null;
  generation_id?: string | null;
  generation_lookup?: Lookup;
  generation_superseded?: boolean;
  generation_generated_at?: string | null;
  generation_superseded_at?: string | null;
  progress_lookup?: Lookup;
  progress_id?: string | null;
  progress_fully_completed?: boolean;
  progress_started_at?: string | null;
  progress_completed_at?: string | null;
  progress_task_matches_submitted?: boolean;
  progress_owner_lookup?: Lookup;
  progress_owner_task_id?: string;
  progress_owner_status?: string | null;
  progress_owner_terminal?: boolean;
  progress_owner_updated_at?: string | null;
  progress_owner_generation_id?: string | null;
  progress_owner_generation_matches_submitted?: boolean;
  progress_owner_generation_lookup?: Lookup;
  progress_owner_generation_superseded?: boolean;
  progress_owner_generation_generated_at?: string | null;
  progress_owner_generation_superseded_at?: string | null;
};

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value)
    ? value.toLowerCase()
    : null;
}

/** Accept only ISO timestamps, emit canonical UTC, and never copy arbitrary DB text. */
function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) return null;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : null;
}

/**
 * Observe an already rejected start; never authorize, retry or change its result.
 * All optional reads share one deadline and suppress only their own SDK events.
 * Rows may change after failure: these are observations, not an atomic reconstruction.
 */
export async function getRejectedStudyPlanDiagnostics(
  admin: SupabaseClient<Database>,
  input: Input,
): Promise<Diagnostics> {
  const started = performance.now();
  const context: Diagnostics = {
    observation:
      input.operation === "practice"
        ? "after_insert_failure"
        : "after_start_failure",
    operation: input.operation,
    observed_at: new Date().toISOString(),
    elapsed_ms: 0,
    student_id: uuid(input.studentId),
    task_id: uuid(input.taskId),
    ...(input.operation === "practice"
      ? { section_id: uuid(input.sectionId) }
      : {
          module_id: uuid(input.moduleId),
          progress_lookup: "not_attempted" as const,
        }),
    task_lookup: "not_attempted",
  };
  const studentId = context.student_id;
  const taskId = context.task_id;
  if (
    !studentId ||
    !taskId ||
    (input.operation === "learning" && !context.module_id)
  )
    return context;
  const scopedStudentId = studentId;

  await Sentry.withScope(async (scope) => {
    // Diagnostic reads can auto-capture before a caller's catch. Keep them in
    // this isolated asynchronous scope; the original capture stays outside it.
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
    async function readTask(id: string) {
      if (controller.signal.aborted)
        return { lookup: "failed" as const, task: null };
      try {
        const { data, error } = await Promise.race([
          admin
            .from("ucat_student_study_plan_tasks")
            .select(
              "id,student_id,status,task_type,section_id,learning_module_id,generation_id,updated_at,started_at,completed_at,skipped_at",
            )
            .eq("id", id)
            .eq("student_id", scopedStudentId)
            .abortSignal(controller.signal)
            .maybeSingle(),
          expired,
        ]);
        if (error) return { lookup: "failed" as const, task: null };
        if (!data)
          return { lookup: "not_found_or_not_owned" as const, task: null };
        const ownerMatches = uuid(data.student_id) === studentId;
        const identityMatches = uuid(data.id) === id;
        return {
          lookup:
            ownerMatches && identityMatches
              ? ("found" as const)
              : ("not_found_or_not_owned" as const),
          task: ownerMatches && identityMatches ? data : null,
          ownerMatches,
          identityMatches,
        };
      } catch {
        return { lookup: "failed" as const, task: null };
      }
    }
    async function queryGeneration(id: string) {
      if (controller.signal.aborted)
        return { lookup: "failed" as const, generation: null };
      try {
        const { data, error } = await Promise.race([
          admin
            .from("ucat_student_study_plan_generations")
            .select("id,student_id,generated_at,superseded_at")
            .eq("id", id)
            .eq("student_id", scopedStudentId)
            .abortSignal(controller.signal)
            .maybeSingle(),
          expired,
        ]);
        if (error) return { lookup: "failed" as const, generation: null };
        if (
          !data ||
          uuid(data.id) !== id ||
          uuid(data.student_id) !== scopedStudentId
        )
          return {
            lookup: "not_found_or_not_owned" as const,
            generation: null,
          };
        return { lookup: "found" as const, generation: data };
      } catch {
        return { lookup: "failed" as const, generation: null };
      }
    }
    const generations = new Map<string, ReturnType<typeof queryGeneration>>();
    function readGeneration(id: string) {
      let pending = generations.get(id);
      if (!pending) {
        pending = queryGeneration(id);
        generations.set(id, pending);
      }
      return pending;
    }
    async function observeTask() {
      const result = await requestedTask;
      context.task_lookup = result.lookup;
      context.task_owner_matches = result.ownerMatches;
      context.task_identity_matches = result.identityMatches;
      const task = result.task;
      if (!task) return;
      context.task_status = STATES.has(task.status) ? task.status : null;
      context.task_type = TYPES.has(task.task_type) ? task.task_type : null;
      context.task_type_matches =
        task.task_type ===
        (input.operation === "practice" ? "practice" : "learn");
      if (context.task_status)
        context.task_terminal = ["completed", "skipped"].includes(
          context.task_status,
        );
      context.task_updated_at = timestamp(task.updated_at);
      context.task_started_at = timestamp(task.started_at);
      context.task_completed_at = timestamp(task.completed_at);
      context.task_skipped_at = timestamp(task.skipped_at);
      if (
        input.operation === "practice" &&
        context.section_id &&
        uuid(task.section_id)
      ) {
        context.task_section_matches =
          uuid(task.section_id) === context.section_id;
      } else if (input.operation === "learning" && context.module_id) {
        context.task_module_matches =
          uuid(task.learning_module_id) === context.module_id;
      }
      context.generation_id = uuid(task.generation_id);
      if (!context.generation_id) return;
      const resultGeneration = await readGeneration(context.generation_id);
      context.generation_lookup = resultGeneration.lookup;
      const generation = resultGeneration.generation;
      if (generation) {
        context.generation_superseded = generation.superseded_at !== null;
        context.generation_generated_at = timestamp(generation.generated_at);
        context.generation_superseded_at = timestamp(generation.superseded_at);
      }
    }
    async function observeProgress() {
      const moduleId = context.module_id;
      if (!moduleId) return;
      try {
        const { data: progress, error } = await Promise.race([
          admin
            .from("ucat_student_learning_module_progress")
            .select(
              "id,student_id,learning_module_id,study_plan_task_id,completion_percent,started_at,completed_at",
            )
            .eq("student_id", scopedStudentId)
            .eq("learning_module_id", moduleId)
            .abortSignal(controller.signal)
            .maybeSingle(),
          expired,
        ]);
        context.progress_lookup = error
          ? "failed"
          : progress &&
              uuid(progress.student_id) === studentId &&
              uuid(progress.learning_module_id) === moduleId
            ? "found"
            : "not_found_or_not_owned";
        if (!progress || context.progress_lookup !== "found") return;
        context.progress_id = uuid(progress.id);
        context.progress_fully_completed = progress.completion_percent === 100;
        context.progress_started_at = timestamp(progress.started_at);
        context.progress_completed_at = timestamp(progress.completed_at);
        const ownerId = uuid(progress.study_plan_task_id);
        context.progress_task_matches_submitted = ownerId === taskId;
        if (!ownerId) {
          context.progress_owner_lookup = "not_attempted";
          return;
        }
        const owner =
          ownerId === taskId ? await requestedTask : await readTask(ownerId);
        context.progress_owner_lookup = owner.lookup;
        if (!owner.task) return;
        if (uuid(owner.task.learning_module_id) !== moduleId) {
          context.progress_owner_lookup = "not_found_or_not_owned";
          return;
        }
        context.progress_owner_task_id = ownerId;
        context.progress_owner_status = STATES.has(owner.task.status)
          ? owner.task.status
          : null;
        if (context.progress_owner_status)
          context.progress_owner_terminal = ["completed", "skipped"].includes(
            context.progress_owner_status,
          );
        context.progress_owner_updated_at = timestamp(owner.task.updated_at);
        const ownerGenerationId = uuid(owner.task.generation_id);
        context.progress_owner_generation_id = ownerGenerationId;
        const submittedGenerationId = uuid(
          (await requestedTask).task?.generation_id,
        );
        if (submittedGenerationId)
          context.progress_owner_generation_matches_submitted =
            ownerGenerationId === submittedGenerationId;
        if (!ownerGenerationId) return;
        const ownerGeneration = await readGeneration(ownerGenerationId);
        context.progress_owner_generation_lookup = ownerGeneration.lookup;
        if (ownerGeneration.generation) {
          context.progress_owner_generation_superseded =
            ownerGeneration.generation.superseded_at !== null;
          context.progress_owner_generation_generated_at = timestamp(
            ownerGeneration.generation.generated_at,
          );
          context.progress_owner_generation_superseded_at = timestamp(
            ownerGeneration.generation.superseded_at,
          );
        }
      } catch {
        context.progress_lookup = "failed";
      }
    }
    const requestedTask = readTask(taskId);
    try {
      await Promise.all([
        observeTask(),
        ...(input.operation === "learning" ? [observeProgress()] : []),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  });
  context.observed_at = new Date().toISOString();
  context.elapsed_ms = Math.max(0, Math.round(performance.now() - started));
  return context;
}
