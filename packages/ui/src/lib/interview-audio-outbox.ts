/** Pending audio is kept across page refreshes until the server acknowledges the stable segment ID. */
export interface InterviewAudioSegment {
  id: string;
  actorId: string;
  roundId: string;
  attemptId: string;
  captureId: string;
  createdAt: number;
  blob: Blob;
  /** Incomplete checkpoints are recovered after a crash, never uploaded mid-take. */
  complete?: boolean;
  startedAt?: string;
  checkpoint?: boolean;
  sequence?: number;
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
export async function recoverInterviewAudio(
  roundId: string,
  actorId: string,
): Promise<string[]> {
  const items = await pending(roundId, actorId);
  const recovered = new Set<string>();
  const chunks = new Map<string, InterviewAudioSegment[]>();
  const completedCaptures = new Set(
    items
      .filter((item) => !item.checkpoint && item.complete === true)
      .map((item) => item.captureId),
  );
  for (const item of items) {
    if (item.checkpoint) {
      if (completedCaptures.has(item.captureId)) continue;
      const key = `${item.captureId}:${item.startedAt ?? ""}`;
      const group = chunks.get(key) ?? [];
      group.push(item);
      chunks.set(key, group);
    } else if (item.complete === false) {
      await saveInterviewAudio({ ...item, complete: true });
      recovered.add(item.captureId);
    }
  }
  for (const group of chunks.values()) {
    group.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const first = group[0]!;
    await saveInterviewAudio({
      ...first,
      id: first.captureId,
      checkpoint: false,
      complete: true,
      blob: new Blob(
        group.map((item) => item.blob),
        { type: first.blob.type },
      ),
    });
    recovered.add(first.captureId);
  }
  return [...recovered];
}
/** Raw chunks from one encoder are append-only locally; they are never separate server recordings. */
export function appendInterviewAudio(
  segment: InterviewAudioSegment,
  sequence: number,
): Promise<void> {
  return saveInterviewAudio({
    ...segment,
    id: `${segment.captureId}:${segment.startedAt ?? segment.createdAt}:${sequence}`,
    checkpoint: true,
    sequence,
    complete: false,
  });
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
    const allSegments = await pending(roundId, actorId);
    const segments = allSegments.filter(
      (item) => item.complete !== false && !item.checkpoint,
    );
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      try {
        const query = new URLSearchParams({
          attemptId: segment.attemptId,
          captureId: segment.captureId,
          segmentId: segment.id,
        });
        const endpoint = `/api/interviews/rounds/${encodeURIComponent(roundId)}/recordings/audio?${query}`;
        if (segment.id === segment.captureId) {
          const metadata = {
            contentType: segment.blob.type.split(";")[0] || "audio/webm",
            byteLength: segment.blob.size,
            startedAt: segment.startedAt,
          };
          const prepared = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...metadata, action: "prepare" }),
          });
          if (!prepared.ok) throw new Error("Unable to prepare audio upload.");
          const { uploadUrl, complete } = (await prepared.json()) as {
            uploadUrl?: string;
            complete?: boolean;
          };
          if (!complete) {
            if (!uploadUrl) throw new Error("Missing signed upload URL.");
            // An interrupted response or duplicate upload can still have stored the
            // immutable object. Only the authenticated finalizer acknowledges it.
            await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": metadata.contentType },
              body: segment.blob,
            }).catch(() => undefined);
            const completed = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...metadata, action: "complete" }),
            });
            if (!completed.ok) throw new Error("Unable to finalize audio.");
          }
        } else {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": segment.blob.type || "audio/webm" },
            body: segment.blob,
          });
          if (!response.ok)
            throw new Error(
              "Audio upload failed. Pending audio remains on this device for retry.",
            );
        }
        const acknowledged = [
          segment.id,
          ...allSegments
            .filter(
              (item) => item.checkpoint && item.captureId === segment.captureId,
            )
            .map((item) => item.id),
        ];
        acknowledged.forEach((id) => memory.delete(id));
        await transaction("readwrite", (store) => {
          let last = store.delete(acknowledged[0]!);
          for (const id of acknowledged.slice(1)) last = store.delete(id);
          return last;
        });
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
