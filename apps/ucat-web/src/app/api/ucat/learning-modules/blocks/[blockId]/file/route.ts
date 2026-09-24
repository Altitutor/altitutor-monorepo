import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ blockId: string }> };

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(request: NextRequest, context: RouteContext) {
  const { blockId } = await context.params;
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

  const { data: block, error: blockError } = await supabase
    .from("vstudent_ucat_learning_module_blocks")
    .select("id, block_type, file_id")
    .eq("id", blockId)
    .eq("block_type", "file")
    .maybeSingle();

  if (blockError) {
    captureApiError(blockError, "/api/ucat/learning-modules/blocks/[blockId]/file");
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (!block?.file_id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "File signing is not configured" }, { status: 500 });
  }

  const { data: file, error: fileError } = await supabaseAdmin
    .from("files")
    .select("bucket, storage_path, filename")
    .eq("id", block.file_id)
    .maybeSingle();

  if (fileError) {
    captureApiError(fileError, "/api/ucat/learning-modules/blocks/[blockId]/file");
    return NextResponse.json({ error: fileError.message }, { status: 500 });
  }
  if (!file?.bucket || !file.storage_path) {
    return NextResponse.json({ error: "File storage record not found" }, { status: 404 });
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(file.bucket)
    .createSignedUrl(
      file.storage_path,
      SIGNED_URL_TTL_SECONDS,
      shouldDownload ? { download: file.filename ?? true } : undefined,
    );

  if (signedError || !signed?.signedUrl) {
    captureApiError(signedError, "/api/ucat/learning-modules/blocks/[blockId]/file");
    return NextResponse.json(
      { error: signedError?.message ?? "Failed to sign file" },
      { status: 500 },
    );
  }

  const response = NextResponse.redirect(signed.signedUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
