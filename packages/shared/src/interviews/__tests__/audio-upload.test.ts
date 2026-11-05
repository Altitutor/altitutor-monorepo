import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/generated";
import { createInterviewMediaHandlers } from "../server/http";

const roundId = "10000000-0000-4000-8000-000000000001";
const captureId = "10000000-0000-4000-8000-000000000002";
const tutorId = "10000000-0000-4000-8000-000000000003";
const startedAt = new Date(Date.now() - 1000).toISOString();
const path = `${roundId}/${captureId}/${captureId}.webm`;
function fixture() {
  let ready = false;
  const capture = {
    id: captureId,
    attempt_id: "attempt",
    created_at: new Date(Date.now() - 2000).toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const round = {
    delivery: "in_person",
    recordingEnabled: true,
    attempts: [{ id: "attempt", stationId: "station" }],
    assignments: [{ stationId: "station", tutorId }],
  };
  const chain = (result: () => unknown) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: result(), error: null }),
    };
    return query;
  };
  const sign = jest.fn(async () => ({
    data: { signedUrl: "https://local-storage.test/signed" },
    error: null,
  }));
  const info = jest.fn(async () => ({
    data: { size: 10, contentType: "audio/webm" },
    error: null,
  }));
  const rpc = jest.fn(async () => ({ data: {}, error: null }));
  const service = {
    from: (table: string) =>
      chain(() =>
        table === "interview_media_sessions"
          ? capture
          : {
              id: captureId,
              attempt_id: "attempt",
              state: ready ? "ready" : "pending",
              storage_path: ready ? path : null,
              started_at: ready ? startedAt : null,
            },
      ),
    storage: { from: () => ({ createSignedUploadUrl: sign, info }) },
    rpc,
  } as unknown as SupabaseClient<Database>;
  const user = {
    from: () => chain(() => ({ data: round })),
    rpc: async () => ({ data: tutorId, error: null }),
  } as unknown as SupabaseClient<Database>;
  const handlers = createInterviewMediaHandlers({
    role: "tutor",
    resolveActor: async () => ({ userId: tutorId, userClient: user }),
    serviceClient: () => service,
    apiKey: () => undefined,
    errorResponse: () => Response.json({ error: "failure" }, { status: 500 }),
  });
  const request = (action: string) =>
    new Request(
      `http://localhost/api/interviews/rounds/${roundId}/recordings/audio?captureId=${captureId}&segmentId=${captureId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          action,
          contentType: "audio/webm",
          byteLength: 10,
          startedAt,
        }),
      },
    );
  return {
    handlers,
    request,
    sign,
    info,
    rpc,
    setReady: () => {
      ready = true;
    },
  };
}

it("grants only an immutable capture-scoped upload, then finalizes verified Storage metadata", async () => {
  const f = fixture();
  expect(
    (await f.handlers.uploadAudio(f.request("prepare"), roundId)).status,
  ).toBe(200);
  expect(f.sign).toHaveBeenCalledWith(path, { upsert: false });
  expect(
    (await f.handlers.uploadAudio(f.request("complete"), roundId)).status,
  ).toBe(200);
  expect(f.info).toHaveBeenCalledWith(path);
  expect(f.rpc).toHaveBeenCalledWith(
    "interview_audio_segment",
    expect.objectContaining({
      p_capture_id: captureId,
      p_segment_id: captureId,
      p_storage_path: path,
      p_started_at: startedAt,
    }),
  );
});
it("never issues a replayable upload grant for finalized recordings", async () => {
  const f = fixture();
  f.setReady();
  expect(
    await (await f.handlers.uploadAudio(f.request("prepare"), roundId)).json(),
  ).toMatchObject({ complete: true });
  expect(f.sign).not.toHaveBeenCalled();
});
it("rejects mismatched uploaded bytes before publishing a recording", async () => {
  const f = fixture();
  f.info.mockResolvedValueOnce({
    data: { size: 9, contentType: "audio/webm" },
    error: null,
  });
  expect(
    (await f.handlers.uploadAudio(f.request("complete"), roundId)).status,
  ).toBe(400);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("rejects cross-origin recording uploads before issuing grants", async () => {
  const f = fixture();
  const request = f.request("prepare");
  request.headers.set("origin", "https://foreign.test");
  expect((await f.handlers.uploadAudio(request, roundId)).status).toBe(403);
  expect(f.sign).not.toHaveBeenCalled();
});
it("bounds metadata streams even when Content-Length is absent", async () => {
  const f = fixture();
  const original = f.request("prepare");
  const request = new Request(original.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(5000) }),
  });
  expect((await f.handlers.uploadAudio(request, roundId)).status).toBe(413);
  expect(f.sign).not.toHaveBeenCalled();
});
