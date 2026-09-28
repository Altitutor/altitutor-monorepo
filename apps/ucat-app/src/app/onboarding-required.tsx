import { useState } from "react";
import { Stack } from "expo-router/stack";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { useOnboardingAccess } from "@/features/auth/onboarding-access";
import { signInWithBrowser } from "@/features/auth/browser-auth";
import { supabase } from "@/lib/supabase";

export default function OnboardingRequired() {
  const access = useOnboardingAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function continueOnWeb() {
    setBusy(true);
    setError(null);
    try {
      // The mobile return page resumes incomplete web signup before returning.
      await signInWithBrowser("login");
      await access.refetch();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Finish setting up",
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      {access.isPending ? (
        <Loading />
      ) : access.error ? (
        <Failure error={access.error} retry={() => void access.refetch()} />
      ) : (
        <Group>
          <Copy large>Finish your UCAT setup</Copy>
          <Copy>
            Complete your account setup on the website, then come straight back
            to the app.
          </Copy>
          <Action
            title={busy ? "Opening setup…" : "Continue setup on web"}
            disabled={busy}
            onPress={() => void continueOnWeb()}
          />
        </Group>
      )}
      {error ? <Failure error={error} /> : null}
      <Action
        secondary
        tone="danger"
        title="Sign out"
        disabled={busy}
        onPress={() => {
          void supabase.auth.signOut().then(({ error }) => {
            if (error) setError(error);
          });
        }}
      />
    </Screen>
  );
}
