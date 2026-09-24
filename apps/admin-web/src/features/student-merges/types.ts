import type { Tables } from "@altitutor/shared";

export interface DuplicateCandidate {
  a_id: string;
  b_id: string;
  a_name: string;
  b_name: string;
  reasons: string[];
  fingerprint: string;
}
export interface MergeStudent
  extends Omit<
    Tables<"students">,
    "invite_token" | "registration_public_token" | "legacy_registration_token"
  > {
  sign_in_methods: string[];
  login_email: string | null;
  saved_cards: Array<{ brand: string; last4: string; is_default: boolean }>;
  last_sign_in_at: string | null;
  billing: Tables<"students_billing"> | null;
  parents: Array<{ id: string; name: string }>;
}
export interface MergePreview {
  students: MergeStudent[];
  counts: Record<string, number>;
  blockers: string[];
  fingerprint: string;
}
export const MERGE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "school",
  "curriculum",
  "year_level",
  "birthday",
  "timezone",
  "status",
  "account_class",
  "availability_monday",
  "availability_tuesday",
  "availability_wednesday",
  "availability_thursday",
  "availability_friday",
  "availability_saturday_am",
  "availability_saturday_pm",
  "availability_sunday_am",
  "availability_sunday_pm",
  "registered_at",
  "active_at",
  "discontinued_at",
  "discontinued_by",
  "onboarding_progress",
  "ucat_online_tier_override",
  "ucat_onboarding_completed_at",
  "ucat_unlimited_trial_consumed_at",
  "ucat_signup_step",
  "ucat_signup_completed_at",
  "ucat_initial_familiarity",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export function fieldLabel(field: string): string {
  if (field === "status") return "In-person status";
  if (field === "account_class") return "Test or external account";
  return field.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ") || "None";
  if (typeof value === "object")
    return (
      Object.entries(value)
        .map(([key, item]) => `${fieldLabel(key)}: ${displayValue(item)}`)
        .join("; ") || "Not started"
    );
  return String(value);
}
export function conflictingFields(
  retained: MergeStudent,
  source: MergeStudent,
): MergeField[] {
  return MERGE_FIELDS.filter(
    (key) =>
      retained[key] != null &&
      source[key] != null &&
      JSON.stringify(retained[key]) !== JSON.stringify(source[key]),
  );
}
