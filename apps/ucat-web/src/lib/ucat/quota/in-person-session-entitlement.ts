import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<Database>;

export type InPersonSessionResourceType =
  | "question"
  | "question_stem"
  | "question_set"
  | "mock"
  | "learning_module"
  | "skill_trainer";

export async function hasInPersonSessionResourceEntitlement(
  supabase: AdminClient,
  studentId: string,
  resourceType: InPersonSessionResourceType,
  resourceId: string | null | undefined,
): Promise<boolean> {
  if (!resourceId) return false;

  const { data, error } = await supabase.rpc(
    "student_has_in_person_ucat_session_resource",
    {
      p_student_id: studentId,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
    },
  );

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getInPersonSessionResourceEntitlementIds(
  supabase: AdminClient,
  studentId: string,
  resourceType: InPersonSessionResourceType,
  resourceIds: Array<string | null | undefined>,
): Promise<Set<string>> {
  const uniqueIds = Array.from(
    new Set(resourceIds.filter((id): id is string => Boolean(id))),
  );
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc(
    "student_in_person_ucat_session_resource_ids",
    {
      p_student_id: studentId,
      p_resource_type: resourceType,
      p_resource_ids: uniqueIds,
    },
  );

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.resource_id));
}
