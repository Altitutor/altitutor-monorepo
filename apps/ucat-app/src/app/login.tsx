import { useState } from "react";
import { useWindowDimensions, Text, View } from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Action, useColors } from "@/components/ui";
import { AppIcon } from "@/components/app-icon";
import { useAppTheme } from "@/features/settings/theme";
import { configured } from "@/lib/supabase";
import { signInWithBrowser } from "@/features/auth/browser-auth";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const short = height < 580;
  const c = useColors();
  const { scheme } = useAppTheme();
  const [busy, setBusy] = useState<"login" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function signIn(mode: "login" | "signup") {
    setBusy(mode);
    setError(null);
    try {
      await signInWithBrowser(mode);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        paddingHorizontal: 28,
        paddingTop: Math.max(insets.top, 28),
        paddingBottom: Math.max(insets.bottom, 24),
        gap: compact ? 16 : 28,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.tint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppIcon name="book" size={21} color={c.accent} />
        </View>
        <Text
          style={{
            color: c.text,
            fontSize: 16,
            letterSpacing: 2,
            fontWeight: "700",
          }}
        >
          ALTITUTOR{" "}
          <Text style={{ color: c.accent, fontWeight: "400" }}>UCAT</Text>
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingVertical: compact ? 8 : 24,
          gap: compact ? 14 : 28,
        }}
      >
        {!short && (
          <View
            accessible={false}
            style={{
              width: compact ? 92 : 130,
              height: compact ? 92 : 130,
              borderRadius: 65,
              backgroundColor: c.tint,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <View
              style={{
                width: compact ? 68 : 92,
                height: compact ? 68 : 92,
                borderRadius: 46,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon name="brain" color="#FFFFFF" size={46} />
            </View>
          </View>
        )}
        <View style={{ gap: compact ? 8 : 16 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: short ? 27 : compact ? 34 : 43,
              lineHeight: short ? 31 : compact ? 39 : 49,
              fontWeight: "700",
              letterSpacing: -1.5,
            }}
          >
            Your next step{"\n"}
            <Text style={{ color: c.accent }}>towards medicine.</Text>
          </Text>
          {!short && (
            <Text
              style={{ color: c.secondary, fontSize: 18, lineHeight: 27 }}
            >
              Build confidence, sharpen your skills, and make every study
              session count.
            </Text>
          )}
        </View>
        {!short && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {["Learn", "Practise", "Improve"].map((label) => (
              <View
                key={label}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: c.secondary, fontSize: 14 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ gap: short ? 8 : 12 }}>
        {(!configured || error) && (
          <Text
            accessibilityRole="alert"
            selectable
            style={{ color: c.danger, fontSize: 15, lineHeight: 22 }}
          >
            {error ?? "Sign-in is not configured for this build."}
          </Text>
        )}
        <Action
          title={busy === "login" ? "Signing in…" : "Sign in"}
          disabled={Boolean(busy) || !configured}
          onPress={() => void signIn("login")}
        />
        <Action
          title={busy === "signup" ? "Creating account…" : "Create an account"}
          secondary
          disabled={Boolean(busy) || !configured}
          onPress={() => void signIn("signup")}
        />
        {!short && (
          <Text
            style={{
              color: c.secondary,
              fontSize: 13,
              lineHeight: 20,
              textAlign: "center",
              paddingTop: 4,
            }}
          >
            Continue securely in your browser, then return to the app.
          </Text>
        )}
      </View>
    </View>
  );
}
