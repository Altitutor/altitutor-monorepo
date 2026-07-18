import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Path must look like ucat-images storage path: temp/uuid/file or uuid/file, no traversal. */
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/;

const REFRESHED_URL_EXPIRY_SECONDS = 86400;

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    captureApiError(authError, "/api/ucat/images/signed-urls");
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  let body: { paths?: string[]; fileIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestedPaths = Array.isArray(body.paths) ? body.paths : [];
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      )
    : [];

  if (requestedPaths.length === 0 && fileIds.length === 0) {
    return NextResponse.json(
      { error: "paths or fileIds must be a non-empty array" },
      { status: 400 },
    );
  }

  if (requestedPaths.length + fileIds.length > 50) {
    return NextResponse.json(
      { error: "Too many image references (max 50)" },
      { status: 400 },
    );
  }

  for (const p of requestedPaths) {
    if (typeof p !== "string" || !VALID_PATH.test(p) || p.includes("..")) {
      return NextResponse.json(
        { error: `Invalid path: ${String(p).slice(0, 80)}` },
        { status: 400 },
      );
    }
  }

  const paths = [...requestedPaths];
  if (fileIds.length > 0) {
    const { data: files, error } = await supabaseAdmin
      .from("files")
      .select("id, bucket, storage_path")
      .in("id", fileIds);

    if (error) {
      captureApiError(error, "/api/ucat/images/signed-urls");
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pathByFileId = new Map(
      (files ?? [])
        .filter(
          (file) =>
            file.bucket === "ucat-images" &&
            typeof file.storage_path === "string",
        )
        .map((file) => [file.id, file.storage_path as string]),
    );

    for (const fileId of fileIds) {
      const path = pathByFileId.get(fileId);
      if (!path) {
        return NextResponse.json(
          { error: "Image file not found", fileId },
          { status: 404 },
        );
      }
      paths.push(path);
    }
  }

  const signedUrls: string[] = [];
  for (const path of paths) {
    const { data, error } = await supabaseAdmin.storage
      .from("ucat-images")
      .createSignedUrl(path, REFRESHED_URL_EXPIRY_SECONDS);

    if (error) {
      captureApiError(error, "/api/ucat/images/signed-urls");
      return NextResponse.json(
        { error: error.message, path },
        { status: error.message === "Object not found" ? 404 : 500 },
      );
    }

    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: "No signed URL returned", path },
        { status: 500 },
      );
    }

    signedUrls.push(data.signedUrl);
  }

  return NextResponse.json({ signedUrls });
}
