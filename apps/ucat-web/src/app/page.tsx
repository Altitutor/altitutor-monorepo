import { redirect } from "next/navigation";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

export default async function AppEntryRedirect() {
  const result = await loadUcatPortalAccess();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "unavailable") return <PortalAccessUnavailable />;
  if (result.access.activeStaffRole) redirect("/auth/staff-account");
  redirect(result.access.signupCompleted === true ? "/dashboard" : "/signup/complete");
}
