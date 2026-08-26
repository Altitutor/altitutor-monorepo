import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VERIFIED_USER_ID_HEADER } from "@altitutor/shared";
import { PortalAccessUnavailable } from "@/features/auth/components/PortalAccessUnavailable";
import { loadAdminPortalAccess } from "@/features/auth/server/portal-access";
import AdminClientLayout from "./client-layout";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const verifiedUserId = (await headers()).get(VERIFIED_USER_ID_HEADER);
  const access = await loadAdminPortalAccess(verifiedUserId);

  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "denied") redirect("/login?error=access_denied");
  if (access.status === "redirect_tutor") {
    redirect(
      process.env.NEXT_PUBLIC_TUTOR_PORTAL_URL ??
        (process.env.NODE_ENV === "production"
          ? "https://tutor.altitutor.com"
          : "http://localhost:3002"),
    );
  }
  if (access.status === "unavailable") return <PortalAccessUnavailable />;

  return <AdminClientLayout>{children}</AdminClientLayout>;
}
