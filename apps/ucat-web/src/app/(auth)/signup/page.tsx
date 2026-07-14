import { SignupForm } from "@/features/auth";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureUcatReferral } from "@/lib/ucat/referrals/capture-referral";

type PageProps = {
  searchParams: Promise<{ redirect?: string; ref?: string }>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo =
    params.redirect && params.redirect.startsWith("/")
      ? params.redirect
      : "/subscribe";
  const requestedReferralCode =
    typeof params.ref === "string" ? params.ref.trim().toUpperCase() : "";
  const referralCode = /^[A-Z0-9]{8,16}$/.test(requestedReferralCode)
    ? requestedReferralCode
    : null;

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
  return <SignupForm redirectTo={redirectTo} referralCode={referralCode} />;
}
