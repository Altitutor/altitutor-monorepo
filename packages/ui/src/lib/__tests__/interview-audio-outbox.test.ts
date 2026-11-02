import {
  flushInterviewAudio,
  saveInterviewAudio,
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
