import { parseSignupPlanIntent } from "@/features/auth/lib/signup-plan-intent";

export const SOCIAL_AUTH_PROVIDERS = ["google", "apple"] as const;

export type SocialAuthProvider = (typeof SOCIAL_AUTH_PROVIDERS)[number];
export type SocialAuthIntent = "login" | "signup" | "link";

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{8,16}$/;

export function isSocialAuthProvider(
  value: string | null | undefined,
): value is SocialAuthProvider {
  return SOCIAL_AUTH_PROVIDERS.includes(value as SocialAuthProvider);
}

export function parseSocialAuthIntent(
  value: string | null | undefined,
): SocialAuthIntent {
  if (value === "signup" || value === "link") return value;
  return "login";
}

export function getEnabledSocialAuthProviders(
  env: Record<string, string | undefined> = process.env,
): SocialAuthProvider[] {
  return SOCIAL_AUTH_PROVIDERS.filter((provider) => {
    const value =
      provider === "google" ? env.AUTH_GOOGLE_ENABLED : env.AUTH_APPLE_ENABLED;
    return value === "1" || value?.toLowerCase() === "true";
  });
}

export function normalizeReferralCode(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function buildSocialAuthCallbackUrl({
  origin,
  intent,
  provider,
  next,
  newsletterOptIn = false,
  referralCode,
}: {
  origin: string;
  intent: SocialAuthIntent;
  provider: SocialAuthProvider;
  next: string;
  newsletterOptIn?: boolean;
  referralCode?: string | null;
}): string {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("intent", intent);
  callback.searchParams.set("provider", provider);
  callback.searchParams.set("next", next);

  if (intent === "signup") {
    callback.searchParams.set("newsletter", newsletterOptIn ? "1" : "0");
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    if (normalizedReferralCode) {
      callback.searchParams.set("ref", normalizedReferralCode);
    }
  }

  return callback.toString();
}

export function resolvePostAuthDestination({
  intent,
  provider,
  next,
  signupCompleted,
}: {
  intent: SocialAuthIntent;
  provider: SocialAuthProvider | null;
  next: string;
  signupCompleted: boolean;
}): string {
  if (intent === "link") {
    const params = new URLSearchParams({ linked: "1" });
    if (provider) params.set("provider", provider);
    return `/settings/profile?${params.toString()}`;
  }

  if (!signupCompleted) {
    const planIntent = parseSignupPlanIntent(next);
    return planIntent
      ? `/signup/complete?redirect=${encodeURIComponent(planIntent.checkoutPath)}`
      : "/signup/complete";
  }

  return next;
}
