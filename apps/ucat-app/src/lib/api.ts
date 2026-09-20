import { supabase } from "@/lib/supabase";
import { createApiClient } from "./api-client";
export { ApiError } from "./api-client";

export function webUrl(path: string): string {
  const origin = process.env.EXPO_PUBLIC_UCAT_WEB_URL;
  if (!origin) throw new Error("The UCAT server is not configured.");
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid UCAT path.");
  return new URL(path, origin).toString();
}

export const api = createApiClient(supabase.auth, webUrl);
