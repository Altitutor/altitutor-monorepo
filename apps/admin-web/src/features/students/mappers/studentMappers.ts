import type { TablesUpdate } from "@altitutor/shared";
import type { DetailsFormData } from "../components/tabs";

export function mapDetailsFormToStudentUpdate(
  data: DetailsFormData,
): TablesUpdate<"students"> {
  return {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email || null,
    phone: data.phone || null,
    birthday: data.birthday || null,
    ucat_analytics_account_class: data.analyticsAccountClass ?? "external",
  } as TablesUpdate<"students">;
}
