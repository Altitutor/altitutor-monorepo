import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/app/auth/callback/auth-callback-utils";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";
import {
  isSocialAuthProvider,
  parseSocialAuthIntent,
  resolvePostAuthDestination,
} from "@/features/auth/lib/social-auth";
import { resolveUcatPortalAccess } from "@/features/auth/server/portal-access";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const intent = parseSocialAuthIntent(url.searchParams.get("intent"));
  const providerParam = url.searchParams.get("provider");
  const provider = isSocialAuthProvider(providerParam) ? providerParam : null;
  const next = safePostAuthReturnPath(
    safeNextPath(url.searchParams.get("next")),
  );
  const result = await resolveUcatPortalAccess();

  if (result.status === "unauthenticated") {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(loginUrl);
  }
  if (result.status === "unavailable") {
    return new NextResponse(
      "UCAT account services are temporarily unavailable. Please try again.",
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  if (result.access.activeStaffRole) {
    return NextResponse.redirect(new URL("/auth/staff-account", url.origin));
  }

  const destination = resolvePostAuthDestination({
    intent,
    provider,
    next,
    signupCompleted:
      intent === "link" ? true : result.access.signupCompleted === true,
  });

  return NextResponse.redirect(new URL(destination, url.origin));
}
