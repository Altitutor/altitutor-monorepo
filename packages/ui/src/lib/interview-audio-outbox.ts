/** Pending audio is kept across page refreshes until the server acknowledges the stable segment ID. */
export interface InterviewAudioSegment {
  id: string;
  actorId: string;
  roundId: string;
  attemptId: string;
  captureId: string;
  createdAt: number;
  blob: Blob;
}
const memory = new Map<string, InterviewAudioSegment>();
const uploads = new Map<
  string,
  Promise<{ pending: number; error: string | null }>
>();
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("altitutor-interview-audio", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("segments", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("segments", mode);
      const request = action(tx.objectStore("segments"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function saveInterviewAudio(
  segment: InterviewAudioSegment,
): Promise<void> {
  memory.set(segment.id, segment);
  await transaction("readwrite", (store) => store.put(segment));
}
async function pending(
  roundId: string,
  actorId: string,
): Promise<InterviewAudioSegment[]> {
  const stored = await transaction("readonly", (store) => store.getAll()).catch(
    () => [] as InterviewAudioSegment[],
  );
  const merged = new Map(stored.map((segment) => [segment.id, segment]));
  for (const segment of memory.values()) merged.set(segment.id, segment);
  const expired = [...merged.values()].filter(
    (segment) => segment.createdAt < Date.now() - 90 * 24 * 60 * 60 * 1000,
  );
  for (const segment of expired) {
    memory.delete(segment.id);
    merged.delete(segment.id);
    await transaction("readwrite", (store) => store.delete(segment.id)).catch(
      () => undefined,
    );
  }
  return [...merged.values()]
    .filter(
      (segment) => segment.roundId === roundId && segment.actorId === actorId,
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}
export function flushInterviewAudio(
  roundId: string,
  actorId: string,
): Promise<{ pending: number; error: string | null }> {
  const key = `${actorId}:${roundId}`;
  const existing = uploads.get(key);
  if (existing) return existing;
  const upload = (async () => {
    const segments = await pending(roundId, actorId);
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      try {
        const query = new URLSearchParams({
          attemptId: segment.attemptId,
          captureId: segment.captureId,
          segmentId: segment.id,
        });
        const response = await fetch(
          `/api/interviews/rounds/${encodeURIComponent(roundId)}/recordings/audio?${query}`,
          {
            method: "POST",
            headers: { "Content-Type": segment.blob.type || "audio/webm" },
            body: segment.blob,
          },
        );
        if (!response.ok)
          throw new Error(
            "Audio upload failed. Pending audio remains on this device for retry.",
          );
        memory.delete(segment.id);
        await transaction("readwrite", (store) => store.delete(segment.id));
      } catch {
        return {
          pending: segments.length - index,
          error:
            "Audio upload failed. Keep this page open or return on this device to retry. The interview can continue.",
        };
      }
    }
    return { pending: 0, error: null };
  })().finally(() => uploads.delete(key));
  uploads.set(key, upload);
  return upload;
}
