import { ForgotPasswordForm, LoginPageLayout } from "@/features/auth";
import { redirect } from "next/navigation";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const access = await loadUcatPortalAccess();
  if (access.status === "unavailable") return <PortalAccessUnavailable />;
  if (access.status === "allowed") {
    if (access.access.activeStaffRole) redirect("/auth/staff-account");
    redirect(access.access.signupCompleted === true ? "/dashboard" : "/signup/complete");
  }
  const initialError = params.error?.trim() || null;

  return (
    <LoginPageLayout
      title="Reset password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
      footer={null}
    >
      <ForgotPasswordForm initialError={initialError} />
    </LoginPageLayout>
  );
}
