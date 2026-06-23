import type {
  ActiveExamAttempt,
  BeginExamAttemptInput,
  ExamAttemptKind,
  SyncExamAttemptInput,
} from "@/lib/ucat/exam-attempt/types";
import type { StoredExamSnapshot } from "@/lib/ucat/exam-attempt/service";
import { assertOkOrQuotaExceeded } from "@/lib/ucat/quota/parse-quota-error";

export async function fetchActiveExamAttempt(): Promise<ActiveExamAttempt | null> {
  const response = await fetch("/api/ucat/exam-attempts/active", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load active exam attempt");
  }
  const data = (await response.json()) as { active: ActiveExamAttempt | null };
  return data.active;
}

export async function beginExamAttempt(
  input: BeginExamAttemptInput & {
    examMeta: StoredExamSnapshot["exam"];
    examTiming?: StoredExamSnapshot["examTiming"];
    resumeOnly?: boolean;
  },
): Promise<{ attempt: ActiveExamAttempt; resumed: boolean }> {
  const response = await fetch("/api/ucat/exam-attempts/begin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 409) {
    const data = (await response.json()) as {
      error: string;
      active: ActiveExamAttempt;
    };
    const err = new Error(data.error) as Error & { active?: ActiveExamAttempt };
    err.active = data.active;
    throw err;
  }
  if (!response.ok) {
    await assertOkOrQuotaExceeded(response);
    throw new Error("Failed to begin exam attempt");
  }
  return response.json();
}

export async function syncExamAttempt(
  input: SyncExamAttemptInput & {
    examMeta?: StoredExamSnapshot["exam"];
    examTiming?: StoredExamSnapshot["examTiming"];
    mockAttemptId?: string | null;
  },
): Promise<{ currentSegmentEndsAt: string | null }> {
  const response = await fetch("/api/ucat/exam-attempts/sync", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to sync exam attempt");
  }
  return response.json();
}

export function syncExamAttemptKeepalive(
  input: SyncExamAttemptInput & {
    examMeta?: StoredExamSnapshot["exam"];
    examTiming?: StoredExamSnapshot["examTiming"];
    mockAttemptId?: string | null;
  },
): void {
  void fetch("/api/ucat/exam-attempts/sync", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => {
    // Navigation must not be blocked if the final best-effort flush fails.
  });
}

export async function finalizeExamAttempt(input: {
  kind: ExamAttemptKind;
  attemptId: string;
}): Promise<unknown> {
  const response = await fetch("/api/ucat/exam-attempts/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, complete: true }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? "Failed to finalize exam attempt");
  }
  return response.json();
}
