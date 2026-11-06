import "react-native-url-polyfill/auto";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@altitutor/shared";
import { resolveServerUrl } from "@/lib/development-server-url";

export const configured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.EXPO_PUBLIC_TUTOR_WEB_URL,
);
const storage = {
  getItem: (key: string) =>
    process.env.EXPO_OS === "web"
      ? Promise.resolve(
          typeof localStorage === "undefined"
            ? null
            : localStorage.getItem(key),
        )
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    process.env.EXPO_OS === "web"
      ? Promise.resolve(
          typeof localStorage !== "undefined"
            ? localStorage.setItem(key, value)
            : undefined,
        )
      : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    process.env.EXPO_OS === "web"
      ? Promise.resolve(
          typeof localStorage !== "undefined"
            ? localStorage.removeItem(key)
            : undefined,
        )
      : SecureStore.deleteItemAsync(key),
};
const signOutKey = (userId: string) => `tutor-sign-out-${userId}`;

export async function hasPendingSignOut(userId: string) {
  return Boolean(await storage.getItem(signOutKey(userId)));
}

export function setPendingSignOut(userId: string, pending: boolean) {
  return pending ? storage.setItem(signOutKey(userId), '1') : storage.removeItem(signOutKey(userId));
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  resolveServerUrl(process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
  {
    auth: {
      storage,
      storageKey: "tutor-native-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
