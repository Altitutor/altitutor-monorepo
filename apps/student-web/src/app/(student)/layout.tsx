import { redirect } from "next/navigation";
import { PortalAccessUnavailable } from "@/features/auth/components/PortalAccessUnavailable";
import { loadStudentPortalAccess } from "@/features/auth/server/portal-access";
import StudentClientLayout from "./client-layout";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const access = await loadStudentPortalAccess();

  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "denied") redirect("/login?error=access_denied");
  if (access.status === "redirect_admin") {
    const adminPortal = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ?? "http://localhost:3000";
    redirect(new URL("/admin/dashboard", adminPortal).toString());
  }
  if (access.status === "redirect_tutor") {
    const tutorPortal = process.env.NEXT_PUBLIC_TUTOR_PORTAL_URL ?? "http://localhost:3002";
    redirect(new URL("/dashboard", tutorPortal).toString());
  }
  if (access.status === "unavailable") return <PortalAccessUnavailable />;

  return <StudentClientLayout>{children}</StudentClientLayout>;
}
