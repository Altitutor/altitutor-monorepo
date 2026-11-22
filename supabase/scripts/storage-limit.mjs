import { pathToFileURL } from "node:url";

import recordingLimits from "../../packages/shared/src/interviews/recording-limits.json" with { type: "json" };

const requiredBytes = recordingLimits.videoMaximumBytes;

// Hosted Storage has its own global ceiling, independent of bucket migrations.
// Change only that ceiling; keep existing higher limits and feature settings.
export async function ensureRecordingStorageLimit({ projectRef, accessToken, request = fetch }) {
  if (!/^[a-z]{20}$/u.test(projectRef ?? "")) throw new Error("Expected a Supabase project reference");
  if (!accessToken?.trim()) throw new Error("SUPABASE_ACCESS_TOKEN is required");
  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/storage`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const call = async (method, body) => {
    const response = await request(url, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    // Do not print provider bodies or configuration: they can contain secrets.
    if (!response.ok) throw new Error(`Storage configuration ${method} failed (HTTP ${response.status})`);
    return method === "GET" ? response.json() : undefined;
  };
  const readLimit = async () => {
    const config = await call("GET");
    if (!Number.isSafeInteger(config?.fileSizeLimit) || config.fileSizeLimit <= 0) {
      throw new Error("Storage returned an invalid global file size limit");
    }
    return config.fileSizeLimit;
  };
  const previousBytes = await readLimit();
  if (previousBytes >= requiredBytes) {
    return { previousBytes, limitBytes: previousBytes, changed: false };
  }
  await call("PATCH", { fileSizeLimit: requiredBytes });
  const limitBytes = await readLimit();
  if (limitBytes < requiredBytes) {
    throw new Error("Hosted Storage still rejects the configured recording size");
  }
  return { previousBytes, limitBytes, changed: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await ensureRecordingStorageLimit({
      projectRef: process.env.SUPABASE_PROJECT_ID,
      accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    });
    console.log(`Storage upload ceiling verified: ${result.limitBytes} bytes${result.changed ? " (raised)" : " (unchanged)"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Storage configuration failed");
    process.exitCode = 1;
  }
}
