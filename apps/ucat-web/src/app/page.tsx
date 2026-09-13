import { VERIFIED_USER_ID_HEADER } from "@altitutor/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

export default async function AppEntryRedirect() {
  // Middleware is the session boundary. Re-verifying here can race a freshly
  // persisted password session and bounce the first post-login visit to /login.
  const verifiedUserId = (await headers()).get(VERIFIED_USER_ID_HEADER);
  const result = await loadUcatPortalAccess(verifiedUserId);
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "unavailable") return <PortalAccessUnavailable />;
  if (result.access.activeStaffRole) redirect("/auth/staff-account");
  redirect(
    result.access.signupCompleted === true ? "/dashboard" : "/signup/complete",
  );
}
