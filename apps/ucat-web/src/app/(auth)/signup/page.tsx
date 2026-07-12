import { SignupForm } from "@/features/auth";

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
  return <SignupForm redirectTo={redirectTo} referralCode={referralCode} />;
}
