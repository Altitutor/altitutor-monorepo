import { SignupForm } from "@/features/auth";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  captureUcatReferral,
  resolveUcatReferralOfferPreview,
} from "@/lib/ucat/referrals/capture-referral";
import { getEnabledSocialAuthProviders } from "@/features/auth/lib/social-auth";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

type PageProps = {
  searchParams: Promise<{ redirect?: string; ref?: string; error?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo = safePostAuthReturnPath(params.redirect);
  const access = await loadUcatPortalAccess();
  if (access.status === "unavailable") return <PortalAccessUnavailable />;
  if (access.status === "allowed") {
    if (access.access.activeStaffRole) redirect("/auth/staff-account");
    redirect(access.access.signupCompleted === true ? redirectTo : "/signup/complete");
  }
  const requestedReferralCode =
    typeof params.ref === "string" ? params.ref.trim().toUpperCase() : "";
  const referralCode = /^[A-Z0-9]{8,16}$/.test(requestedReferralCode)
    ? requestedReferralCode
    : null;
  const referralOffer = await resolveUcatReferralOfferPreview(referralCode);

  if (referralCode && supabaseAdmin) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (student) {
        await captureUcatReferral(student.id, referralCode);
        redirect("/settings/plan/referrals");
      }
    }
  }
  return (
    <SignupForm
      redirectTo={redirectTo}
      referralCode={referralCode}
      referralOffer={referralOffer}
      enabledSocialProviders={getEnabledSocialAuthProviders()}
      authError={params.error}
    />
  );
}
