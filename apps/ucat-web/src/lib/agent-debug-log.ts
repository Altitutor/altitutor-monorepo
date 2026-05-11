const AGENT_DEBUG_ENDPOINT =
  "http://127.0.0.1:7336/ingest/24632b4e-be12-493d-ae6c-866e439d0cb6";

/** Non-secret: counts how many document.cookie entries look like @supabase/ssr `student-auth` chunks. */
export function probeAuthCookies(): {
  nameCount: number;
  studentAuthRelatedNameCount: number;
  documentCookieCharLen: number;
} {
  if (typeof document === "undefined") {
    return { nameCount: 0, studentAuthRelatedNameCount: 0, documentCookieCharLen: 0 };
  }
  const raw = document.cookie ?? "";
  const names = raw
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n.length > 0);
  const studentAuthRelatedNameCount = names.filter(
    (n) => n === "student-auth" || n.startsWith("student-auth."),
  ).length;
  return {
    nameCount: names.length,
    studentAuthRelatedNameCount,
    documentCookieCharLen: raw.length,
  };
}

export function agentDebugLog(args: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}): void {
  // #region agent log
  fetch(AGENT_DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d1ccf8",
    },
    body: JSON.stringify({
      sessionId: "d1ccf8",
      runId: args.runId ?? "run1",
      hypothesisId: args.hypothesisId,
      location: args.location,
      message: args.message,
      data: args.data ?? {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}
