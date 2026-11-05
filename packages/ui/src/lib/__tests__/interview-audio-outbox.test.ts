import {
  flushInterviewAudio,
  saveInterviewAudio,
  recoverInterviewAudio,
  appendInterviewAudio,
  type InterviewAudioSegment,
} from "../interview-audio-outbox";

const stored = new Map<string, InterviewAudioSegment>();
function installDatabase() {
  const db = {
    close() {},
    transaction() {
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore: () => ({
          put: (segment: InterviewAudioSegment) => {
            stored.set(segment.id, segment);
            return { result: segment.id };
          },
          delete: (id: string) => {
            stored.delete(id);
            return { result: undefined };
          },
          getAll: () => ({ result: [...stored.values()] }),
        }),
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open() {
        const request = {
          result: db,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
}
function segment(id: string, actorId = "actor-1"): InterviewAudioSegment {
  return {
    id,
    actorId,
    roundId: id,
    attemptId: "attempt-1",
    captureId: "capture-1",
    createdAt: Date.now(),
    blob: new Blob(["audio"], { type: "audio/webm;codecs=opus" }),
  };
}
beforeEach(() => {
  stored.clear();
  installDatabase();
  global.fetch = jest.fn();
});

describe("audio upload durability boundary", () => {
  it("recovers append-only chunks as one take and removes checkpoints only after acknowledgment", async () => {
    const audio = {
      ...segment("chunked"),
      id: "chunked-capture",
      captureId: "chunked-capture",
      complete: false,
      startedAt: "2026-11-05T10:00:00Z",
    };
    await appendInterviewAudio(
      { ...audio, blob: new Blob(["second"], { type: "audio/webm" }) },
      1,
    );
    await appendInterviewAudio(
      { ...audio, blob: new Blob(["first"], { type: "audio/webm" }) },
      0,
    );
    expect(stored.size).toBe(2);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(await recoverInterviewAudio(audio.roundId, audio.actorId)).toEqual([
      "chunked-capture",
    ]);
    expect(stored.get(audio.captureId)?.blob.size).toBe(11);
    expect(await stored.get(audio.captureId)?.blob.text()).toBe('firstsecond');
    expect(stored.size).toBe(3);
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ complete: true }),
      } as Response);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    expect(stored.size).toBe(0);
  });
  it("checkpoints a live take locally and uploads one final immutable blob directly to Storage", async () => {
    const audio = {
      ...segment("canonical"),
      id: "capture-1",
      complete: false,
      startedAt: "2026-11-05T10:00:00Z",
    };
    await saveInterviewAudio(audio);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    await saveInterviewAudio({ ...audio, complete: true });
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://local-storage.test/object/sign",
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    const calls = jest.mocked(fetch).mock.calls;
    expect(calls[1]).toEqual([
      "https://local-storage.test/object/sign",
      expect.objectContaining({ method: "PUT", body: audio.blob }),
    ]);
    expect(JSON.parse(calls[2]![1]!.body as string)).toMatchObject({
      action: "complete",
      byteLength: audio.blob.size,
      startedAt: audio.startedAt,
    });
    expect(stored.has(audio.id)).toBe(false);
  });
  it("acknowledges an already finalized take without overwriting its object", async () => {
    const audio = { ...segment("finalized"), id: "capture-1", complete: true };
    await saveInterviewAudio(audio);
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ complete: true }),
    } as Response);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(stored.has(audio.id)).toBe(false);
  });
  it("makes an interrupted checkpoint recoverable for its original actor only", async () => {
    const audio = {
      ...segment("interrupted"),
      id: "capture-1",
      complete: false,
    };
    await saveInterviewAudio(audio);
    expect(await recoverInterviewAudio(audio.roundId, "other")).toEqual([]);
    expect(stored.get(audio.id)?.complete).toBe(false);
    expect(await recoverInterviewAudio(audio.roundId, audio.actorId)).toEqual([
      "capture-1",
    ]);
    expect(stored.get(audio.id)?.complete).toBe(true);
  });
  it("retains the bytes after failure and retries the exact segment ID before deleting acknowledged audio", async () => {
    const audio = segment("retry-round");
    await saveInterviewAudio(audio);
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual(
      expect.objectContaining({ pending: 1, error: expect.any(String) }),
    );
    expect(stored.get(audio.id)?.blob).toBe(audio.blob);
    expect(await flushInterviewAudio(audio.roundId, audio.actorId)).toEqual({
      pending: 0,
      error: null,
    });
    expect(stored.has(audio.id)).toBe(false);
    expect(String(jest.mocked(fetch).mock.calls[1]?.[0])).toContain(
      "captureId=capture-1",
    );
    expect(jest.mocked(fetch).mock.calls[0]?.[0]).toBe(
      jest.mocked(fetch).mock.calls[1]?.[0],
    );
    expect(jest.mocked(fetch).mock.calls[1]?.[1]?.body).toBe(audio.blob);
  });
  it("never uploads another actor’s pending audio after an account switch", async () => {
    const audio = segment("private-round");
    await saveInterviewAudio(audio);
    expect(await flushInterviewAudio(audio.roundId, "another-actor")).toEqual({
      pending: 0,
      error: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(stored.has(audio.id)).toBe(true);
  });
  it("discards pending local audio after 90 days", async () => {
    const audio = {
      ...segment("expired-round"),
      createdAt: Date.now() - 91 * 24 * 60 * 60 * 1000,
    };
    await saveInterviewAudio(audio);
    await flushInterviewAudio(audio.roundId, audio.actorId);
    expect(fetch).not.toHaveBeenCalled();
    expect(stored.has(audio.id)).toBe(false);
  });
});
