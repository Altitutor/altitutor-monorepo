import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/shared/lib/supabase/server-component";
import { loadStudentPortalAccess } from "@/features/auth/server/portal-access";
import { NativeAuthReturn } from "@/features/auth/components/native-auth-return";
import { nativeReturnUrl, validNativeNonce } from "@/features/auth/lib/native-return";

export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };

function HandoffMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-muted-foreground">{body}</p>
    </main>
  );
}

export default async function MobileAuth({
  searchParams,
}: {
  searchParams: Promise<{ callback?: string; state?: string; challenge?: string }>;
}) {
  const params = await searchParams;
  const callback = nativeReturnUrl(params.callback ?? null, process.env.NODE_ENV === "development");
  if (!callback || !validNativeNonce(params.state ?? null) || !validNativeNonce(params.challenge ?? null))
    return (
      <HandoffMessage
        title="Open sign in from the student app"
        body="This sign-in request is invalid. Return to the app and try again."
      />
    );

  const client = await createServerComponentClient();
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
    redirect(`/login?next=${encodeURIComponent(`/mobile-auth?${query}`)}`);
  }
  if (!user.email || !user.email_confirmed_at || user.is_anonymous)
    return (
      <HandoffMessage
        title="Confirm your email"
        body="This account cannot sign in to the student app yet. Return to the app and try again."
      />
    );

  const access = await loadStudentPortalAccess(user.id);
  if (access.status === "unavailable")
    return (
      <HandoffMessage
        title="Please try again"
        body="Account services are temporarily unavailable. Return to the app and sign in again."
      />
    );
  if (access.status !== "allowed")
    return (
      <HandoffMessage
        title="Student account required"
        body="This account cannot sign in to the student app. Book a trial if you are new."
      />
    );

  return (
    <NativeAuthReturn
      callback={callback}
      state={params.state!}
      challenge={params.challenge!}
      email={user.email}
    />
  );
}
