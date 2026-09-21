import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

export function serializeDraft(
  attemptId: string,
  snapshot: ExamEngineSnapshot,
) {
  return JSON.stringify({ version: 1, attemptId, snapshot });
}

export function restoreDraft(
  server: ExamEngineSnapshot,
  attemptId: string,
  value: string | null,
): ExamEngineSnapshot {
  if (!value) return server;
  try {
    const draft = JSON.parse(value) as {
      version?: number;
      attemptId?: string;
      snapshot?: ExamEngineSnapshot;
    };
    if (draft.version !== 1 || draft.attemptId !== attemptId || !draft.snapshot)
      return server;
    // Restore unsent answers for this attempt only. The server owns navigation
    // and timing, including transitions that happened on another device.
    return {
      ...server,
      responseSnapshots: {
        ...server.responseSnapshots,
        ...draft.snapshot.responseSnapshots,
      },
      flaggedIds: draft.snapshot.flaggedIds ?? server.flaggedIds,
    };
  } catch {
    return server;
  }
}
