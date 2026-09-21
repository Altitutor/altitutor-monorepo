import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { openAuthSessionAsync } from "expo-web-browser";
import { webUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  createAuthReturnHandler,
  readPendingAuth,
  type AuthTokens,
  type PendingAuth,
} from "./browser-auth-model";

const PENDING_KEY = "ucat-native-pending-auth";
const store = {
  read: async () =>
    readPendingAuth(
      process.env.EXPO_OS === "web"
        ? sessionStorage.getItem(PENDING_KEY)
        : await SecureStore.getItemAsync(PENDING_KEY),
    ),
  write: async (pending: PendingAuth) => {
    const value = JSON.stringify(pending);
    if (process.env.EXPO_OS === "web")
      sessionStorage.setItem(PENDING_KEY, value);
    else await SecureStore.setItemAsync(PENDING_KEY, value);
  },
  clear: async () => {
    if (process.env.EXPO_OS === "web") sessionStorage.removeItem(PENDING_KEY);
    else await SecureStore.deleteItemAsync(PENDING_KEY);
  },
};
function base64url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function randomSecret() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64url(btoa(String.fromCharCode(...bytes)));
}
const handleReturn = createAuthReturnHandler({
  read: store.read,
  clear: store.clear,
  exchange: async (ticket, verifier) => {
    const response = await fetch(webUrl("/api/auth/native/exchange"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ ticket, verifier }),
      signal: AbortSignal.timeout(30000),
    });
    const data: unknown = await response.json();
    if (
      !response.ok ||
      !data ||
      typeof data !== "object" ||
      !("access_token" in data) ||
      typeof data.access_token !== "string" ||
      !("refresh_token" in data) ||
      typeof data.refresh_token !== "string"
    )
      throw new Error("Unable to complete sign-in. Please sign in again.");
    return data as AuthTokens;
  },
  setSession: async (tokens) => {
    const { error } = await supabase.auth.setSession(tokens);
    if (error) throw error;
  },
});
let pendingReturn: Promise<void> | undefined;
export function completeBrowserAuth(url: string) {
  const promise = handleReturn(url);
  pendingReturn = promise;
  void promise
    .finally(() => {
      if (pendingReturn === promise) pendingReturn = undefined;
    })
    .catch(() => undefined);
  return promise;
}
let launching = false;
export async function signInWithBrowser(mode: "login" | "signup") {
  if (launching) return;
  launching = true;
  await pendingReturn?.catch(() => undefined);
  let state: string | undefined;
  try {
    const [verifier, nextState] = await Promise.all([
      randomSecret(),
      randomSecret(),
    ]);
    state = nextState;
    const challenge = base64url(
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      ),
    );
    const callback = Linking.createURL("auth-return");
    await store.write({ verifier, state, callback, createdAt: Date.now() });
    const handoff = new URL(webUrl("/mobile-auth"));
    handoff.searchParams.set("challenge", challenge);
    handoff.searchParams.set("state", state);
    handoff.searchParams.set("callback", callback);
    const url = mode === "login" ? handoff : new URL(webUrl("/signup"));
    if (mode === "signup")
      url.searchParams.set("redirect", handoff.pathname + handoff.search);
    const result = await openAuthSessionAsync(url.toString(), callback);
    if (result.type === "success") await completeBrowserAuth(result.url);
  } finally {
    await pendingReturn?.catch(() => undefined);
    try {
      const pending = await store.read();
      if (pending?.state === state) await store.clear();
    } finally {
      launching = false;
    }
  }
}
