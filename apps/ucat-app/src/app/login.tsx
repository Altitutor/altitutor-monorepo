import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/app-icon";
import { configured } from "@/lib/supabase";
import { signInWithBrowser } from "@/features/auth/browser-auth";

export default function Login() {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "#171717" }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: Math.max(insets.top, 28),
        paddingBottom: Math.max(insets.bottom, 24),
        gap: 36,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: "#29373C",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppIcon name="book" size={21} color="#B3D0DB" />
        </View>
        <Text
          style={{
            color: "#F8F8F8",
            fontSize: 16,
            letterSpacing: 2,
            fontWeight: "700",
          }}
        >
          ALTITUTOR{" "}
          <Text style={{ color: "#93B6C3", fontWeight: "400" }}>UCAT</Text>
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingVertical: 24,
          gap: 28,
        }}
      >
        <View
          accessible={false}
          style={{
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: "#26363B",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#3D535C",
          }}
        >
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: "#93B6C3",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 45px #93B6C329",
            }}
          >
            <AppIcon name="brain" color="#173442" size={46} />
          </View>
        </View>
        <View style={{ gap: 16 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: "#FAFAFA",
              fontSize: 43,
              lineHeight: 49,
              fontWeight: "700",
              letterSpacing: -1.5,
            }}
          >
            Your next step{"\n"}
            <Text style={{ color: "#A9CBD7" }}>towards medicine.</Text>
          </Text>
          <Text style={{ color: "#B9BEC1", fontSize: 18, lineHeight: 27 }}>
            Build confidence, sharpen your skills, and make every study session
            count.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {["Learn", "Practise", "Improve"].map((label) => (
            <View
              key={label}
              style={{
                borderWidth: 1,
                borderColor: "#343B3E",
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#CBD9DE", fontSize: 14 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {(!configured || error) && (
          <Text
            accessibilityRole="alert"
            selectable
            style={{ color: "#FFB4AB", fontSize: 15, lineHeight: 22 }}
          >
            {error ?? "Sign-in is not configured for this build."}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          disabled={Boolean(busy) || !configured}
          onPress={() => void signIn("login")}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: "#A9CBD7",
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || pressed ? 0.6 : 1,
          })}
        >
          {busy === "login" ? (
            <ActivityIndicator color="#173442" />
          ) : (
            <Text style={{ color: "#132E3C", fontSize: 18, fontWeight: "600" }}>
              Sign in
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          disabled={Boolean(busy) || !configured}
          onPress={() => void signIn("signup")}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: "#252A2C",
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || pressed ? 0.6 : 1,
          })}
        >
          {busy === "signup" ? (
            <ActivityIndicator color="#A9CBD7" />
          ) : (
            <Text style={{ color: "#D8E7ED", fontSize: 18, fontWeight: "600" }}>
              Create an account
            </Text>
          )}
        </Pressable>
        <Text
          style={{
            color: "#919A9E",
            fontSize: 13,
            lineHeight: 20,
            textAlign: "center",
            paddingTop: 4,
          }}
        >
          Continue securely in your browser, then return to the app.
        </Text>
      </View>
    </ScrollView>
  );
}
