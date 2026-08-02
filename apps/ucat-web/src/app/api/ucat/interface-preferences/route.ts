import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@altitutor/shared";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_UCAT_INTERFACE_PREFERENCES,
  parseUcatInterfacePreferences,
  parseUcatInterfacePreferencesPatch,
} from "@/features/interface-preferences/model/types";

const APP_KEY = "ucat-web";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("vstudent_ucat_interface_preferences")
    .select("preferences")
    .eq("app_key", APP_KEY)
    .maybeSingle();
  if (error) {
    captureApiError(error, "/api/ucat/interface-preferences");
    return NextResponse.json(
      { error: "Failed to load interface preferences" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    preferences: parseUcatInterfacePreferences(data?.preferences),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    preferences?: unknown;
  } | null;
  const patch = parseUcatInterfacePreferencesPatch(body?.preferences);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Invalid interface preferences" },
      { status: 400 },
    );
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from("user_interface_preferences")
    .select("preferences")
    .eq("auth_user_id", user.id)
    .eq("app_key", APP_KEY)
    .maybeSingle();
  if (readError) {
    captureApiError(readError, "/api/ucat/interface-preferences");
    return NextResponse.json(
      { error: "Failed to save interface preferences" },
      { status: 500 },
    );
  }

  const preferences = {
    ...DEFAULT_UCAT_INTERFACE_PREFERENCES,
    ...parseUcatInterfacePreferences(existing?.preferences),
    ...patch,
  };
  const { error: writeError } = await supabaseAdmin
    .from("user_interface_preferences")
    .upsert(
      {
        auth_user_id: user.id,
        app_key: APP_KEY,
        preferences: preferences as unknown as Json,
      },
      { onConflict: "auth_user_id,app_key" },
    );
  if (writeError) {
    captureApiError(writeError, "/api/ucat/interface-preferences");
    return NextResponse.json(
      { error: "Failed to save interface preferences" },
      { status: 500 },
    );
  }

  return NextResponse.json({ preferences });
}
