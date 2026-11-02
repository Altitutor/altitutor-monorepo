import { supabase } from "@/lib/supabase";
import { resolveServerUrl } from "@/lib/development-server-url";
import { createApiClient } from "./api-client";
export { ApiError } from "./api-client";

/** Keep emulator browser cookies on loopback while preserving physical-device LAN URLs. */
export function browserWebUrl(path: string): string {
  const origin = process.env.EXPO_PUBLIC_UCAT_WEB_URL;
  if (!origin) throw new Error("The UCAT server is not configured.");
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid UCAT path.");
  return resolveServerUrl(new URL(path, origin).toString(), "browser");
}

export function webUrl(path: string): string {
  return resolveServerUrl(browserWebUrl(path));
}

export const api = createApiClient(supabase.auth, webUrl);
