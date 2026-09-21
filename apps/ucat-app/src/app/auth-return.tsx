import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { Action, Failure, Loading, Screen } from "@/components/ui";
import { completeBrowserAuth } from "@/features/auth/browser-auth";

export default function AuthReturn() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!url) return;
    let mounted = true;
    void completeBrowserAuth(url)
      .then(() => {
        if (mounted) router.replace("/");
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause);
      });
    return () => {
      mounted = false;
    };
  }, [url, router]);
  const failure =
    error ??
    (!url
      ? new Error("No sign-in link was received. Please sign in again.")
      : null);
  return (
    <Screen>
      <Stack.Screen
        options={{ title: "Signing in", headerBackVisible: false }}
      />
      {failure ? (
        <>
          <Failure error={failure} />
          <Action
            title="Back to sign in"
            onPress={() => router.replace("/login")}
          />
        </>
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
