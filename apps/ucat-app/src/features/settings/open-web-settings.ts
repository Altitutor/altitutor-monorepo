import { Alert } from "react-native";
import { openBrowserAsync } from "expo-web-browser";
import { webUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const allowedPaths = new Set([
  "/exam",
  "/settings/profile",
  "/settings/plan",
  "/settings/plan/subscription",
  "/settings/plan/referrals",
  "/settings/study-plan",
]);

export async function openWebSettings(path: string) {
  try {
    if (!allowedPaths.has(path))
      throw new Error("This page cannot be opened from the app.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Please sign in to continue.");
    const response = await fetch(webUrl("/api/auth/browser/ticket"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ path }),
      credentials: "omit",
      signal: AbortSignal.timeout(30000),
    });
    const body: unknown = await response.json();
    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("ticket" in body) ||
      typeof body.ticket !== "string"
    )
      throw new Error("Unable to open your account. Please try again.");
    await openBrowserAsync(
      `${webUrl("/mobile-browser")}#ticket=${encodeURIComponent(body.ticket)}`,
    );
  } catch (error) {
    Alert.alert(
      "Unable to open page",
      error instanceof Error ? error.message : "Please try again.",
    );
  }
}
