import React from "react";
import { founderInvitationDestination } from "@/features/founder-offers/lib/invitation-path";
import { SignupForm } from "@/features/auth";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  captureUcatReferral,
  resolveUcatReferralOfferPreview,
} from "@/lib/ucat/referrals/capture-referral";
import { getEnabledSocialAuthProviders } from "@/features/auth/lib/social-auth";
import {
  pathWithReturnIntent,
  safePostAuthReturnPath,
} from "@/features/auth/lib/return-intent";
import { PortalAccessUnavailable } from "@/features/auth/components/portal-access-unavailable";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

type PageProps = {
  searchParams: Promise<{
    redirect?: string;
    ref?: string;
    offer?: string;
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo =
    founderInvitationDestination(params.offer) ??
    safePostAuthReturnPath(params.redirect);
  const access = await loadUcatPortalAccess();
  if (access.status === "unavailable") return <PortalAccessUnavailable />;
  if (access.status === "allowed") {
    const nativeSignup =
      new URL(redirectTo, "https://ucat.altitutor.com").pathname ===
      "/mobile-auth";
    if (nativeSignup) {
      // Native sign-out can leave browser cookies whose claims still verify.
      // Resume onboarding only for a live session; an explicit create-account
      // action must not bounce through mobile-auth into the login screen.
      const client = await getSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      if (
        !error &&
        user &&
        !access.access.signupCompleted &&
        !access.access.activeStaffRole
      ) {
        redirect(pathWithReturnIntent("/signup/complete", redirectTo));
      }
    } else {
      if (access.access.activeStaffRole) redirect("/auth/staff-account");
      redirect(
        access.access.signupCompleted === true
          ? redirectTo
          : pathWithReturnIntent("/signup/complete", redirectTo),
      );
    }
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
