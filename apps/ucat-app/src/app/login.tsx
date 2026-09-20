import { useState } from "react";
import { openBrowserAsync } from "expo-web-browser";
import { Action, Copy, Failure, Field, Group, Screen } from "@/components/ui";
import { supabase, configured } from "@/lib/supabase";
import { webUrl } from "@/lib/api";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Unable to sign in."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Group>
        <Copy large>Your next step towards medicine.</Copy>
        <Copy muted>
          Build confidence, practise your skills, and keep your UCAT preparation
          moving.
        </Copy>
      </Group>
      {!configured && (
        <Failure
          error={
            new Error(
              "Add the public Supabase settings and UCAT server URL to .env.local to connect this app.",
            )
          }
        />
      )}
      <Group title="Sign in">
        <Field
          accessibilityLabel="Email"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          accessibilityLabel="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={() => {
            if (!busy && configured && email && password) void signIn();
          }}
        />
        <Action
          title={busy ? "Signing in…" : "Sign in"}
          disabled={busy || !email || !password || !configured}
          onPress={() => void signIn()}
        />
        {error && <Failure error={error} />}
      </Group>
      <Action
        title="Forgot password?"
        secondary
        disabled={!configured}
        onPress={() => {
          void openBrowserAsync(webUrl("/forgot-password"));
        }}
      />
      <Action
        title="Create an account"
        secondary
        disabled={!configured}
        onPress={() => {
          void openBrowserAsync(webUrl("/signup"));
        }}
      />
    </Screen>
  );
}
