import { redirect } from "next/navigation";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { StaffAccountNotice } from "@/features/auth/components/staff-account-notice";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

export default async function StaffAccountPage() {
  const result = await loadUcatPortalAccess();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "unavailable") return <PortalAccessUnavailable />;
  const role = result.access.activeStaffRole;
  if (!role) redirect("/dashboard");

  return <StaffAccountNotice role={role} />;
}
