import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/app/auth/callback/auth-callback-utils";
import {
  isSocialAuthProvider,
  parseSocialAuthIntent,
  resolvePostAuthDestination,
} from "@/features/auth/lib/social-auth";
import { resolveSignupStateForUser } from "@/features/signup-onboarding/lib/resolve-signup-state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const intent = parseSocialAuthIntent(url.searchParams.get("intent"));
  const providerParam = url.searchParams.get("provider");
  const provider = isSocialAuthProvider(providerParam) ? providerParam : null;
  const next = safeNextPath(url.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(loginUrl);
  }

  const signupState =
    intent === "link" ? null : await resolveSignupStateForUser(user);
  const destination = resolvePostAuthDestination({
    intent,
    provider,
    next,
    signupCompleted: signupState?.signupCompleted ?? true,
  });

  return NextResponse.redirect(new URL(destination, url.origin));
}
