import { resolveUcatPortalAccess } from "@/features/auth/server/portal-access";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { NativeAuthReturn } from "@/features/auth/components/native-auth-return";
import {
  nativeReturnUrl,
  validNativeNonce,
} from "@/features/auth/lib/native-return";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };
export default async function MobileAuth({
  searchParams,
}: {
  searchParams: Promise<{
    callback?: string;
    state?: string;
    challenge?: string;
  }>;
}) {
  const params = await searchParams;
  const callback = nativeReturnUrl(
    params.callback ?? null,
    process.env.NODE_ENV === "development",
  );
  if (
    !callback ||
    !validNativeNonce(params.state ?? null) ||
    !validNativeNonce(params.challenge ?? null)
  )
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-semibold">
          Open sign in from the UCAT app
        </h1>
        <p className="mt-4">
          This sign-in request is invalid. Return to the app and try again.
        </p>
      </main>
    );
  const client = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    const query = new URLSearchParams({
      callback,
      state: params.state!,
      challenge: params.challenge!,
    });
    redirect(`/login?redirect=${encodeURIComponent(`/mobile-auth?${query}`)}`);
  }
  const access = await resolveUcatPortalAccess(user.id);
  if (access.status !== "allowed")
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-semibold">Please try again</h1>
        <p>
          Account services are temporarily unavailable. Return to the app and
          sign in again.
        </p>
      </main>
    );
  if (access.access.activeStaffRole) redirect("/auth/staff-account");
  if (!access.access.signupCompleted) {
    const query = new URLSearchParams({
      callback,
      state: params.state!,
      challenge: params.challenge!,
    });
    redirect(
      `/signup/complete?redirect=${encodeURIComponent(`/mobile-auth?${query}`)}`,
    );
  }
  return (
    <NativeAuthReturn
      callback={callback}
      state={params.state!}
      challenge={params.challenge!}
      email={user.email ?? "your account"}
    />
  );
}
