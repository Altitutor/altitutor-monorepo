import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyPlanProfileInput } from "@/features/study-plan/model/types";
import { normalizeSjtPreference } from "@/features/preparation/lib/sjt-allocation-policy";
import { midpointDate } from "@/features/study-plan/lib/dates";
type ProfileRow =
  Database["public"]["Tables"]["ucat_student_study_plan_profiles"]["Row"];

function parseAvailability(
  value: Json,
): StudyPlanProfileInput["availableDays"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const weekday = item.weekday;
    if (typeof weekday !== "number" || weekday < 0 || weekday > 6) return [];
    return [{ weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 }];
  });
}

export function profileInput(profile: ProfileRow): StudyPlanProfileInput {
  return {
    studyPlanEnabled: profile.study_plan_enabled,
    targetScore: profile.target_score,
    testYear: profile.test_year,
    testDate: profile.test_date,
    availableDays: parseAvailability(profile.available_days),
    preferredMockWeekday: profile.preferred_mock_weekday as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6,
    sjtPreference: normalizeSjtPreference(profile.sjt_preference),
  };
}

export async function planningDateFor(
  admin: SupabaseClient<Database>,
  profile: ProfileRow,
): Promise<{
  planningDate: string;
  provisional: boolean;
}> {
  if (profile.test_date)
    return { planningDate: profile.test_date, provisional: false };
  const { data } = await admin
    .from("ucat_study_plan_test_windows")
    .select("testing_starts_on, testing_ends_on")
    .eq("test_year", profile.test_year)
    .maybeSingle();
  if (data) {
    return {
      planningDate: midpointDate(data.testing_starts_on, data.testing_ends_on),
      provisional: true,
    };
  }
  return { planningDate: `${profile.test_year}-07-15`, provisional: true };
}
