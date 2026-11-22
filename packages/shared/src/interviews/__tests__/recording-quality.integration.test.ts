import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/generated";
import { createInterviewMediaHandlers } from "../server/http";

const env = (globalThis as typeof globalThis & {
  process: { env: Record<string, string | undefined> };
}).process.env;
const owned = env.ALTITUTOR_OWNED_DB_INNER === "1";

(owned ? describe : describe.skip)("large interview takes through owned Auth, signed Storage and playback", () => {
  const interviewId = "e4922000-0000-4000-8000-000000000001";
  const roundId = "e4922000-0000-4000-8000-000000000002";
  const attemptId = "e4922000-0000-4000-8000-000000000003";
  const stationId = "e4922000-0000-4000-8000-000000000004";
  const tutorId = "00000000-0000-0000-0000-000000000010";
  const studentId = "10000000-0000-0000-0000-000000000001";
  const api = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:1";
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const database = createClient<Database>(api, env.SUPABASE_SERVICE_ROLE_KEY ?? "disabled", options);
  const user = createClient<Database>(api, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "disabled", options);
  let verifiedLocal = false;
  let createdSubjectId: string | undefined;
  let storagePath: string | undefined;
  let state: Record<string, Json | undefined>;
  const handlers = createInterviewMediaHandlers({
    role: "tutor",
    resolveActor: async () => {
      const { data, error } = await user.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Tutor authentication required");
      return { userId: data.user.id, userClient: user };
    },
    serviceClient: () => database,
    apiKey: () => undefined,
    errorResponse: () => Response.json({ error: "Recording operation failed" }, { status: 500 }),
  });
  async function write(result: PromiseLike<{ error: unknown }>) {
    const { error } = await result;
    if (error) throw error;
  }
  beforeAll(async () => {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) throw new Error("Verified owned loopback API required");
    verifiedLocal = true;
    const { data: subject, error } = await database.from("subjects").select("id").eq("name", "Medicine Interview").single();
    if (error) throw error;
    const { data: assignment, error: assignmentError } = await database.from("staff_subjects").select("staff_id").eq("staff_id", tutorId).eq("subject_id", subject.id).maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) {
      await write(database.from("staff_subjects").insert({ staff_id: tutorId, subject_id: subject.id }));
      createdSubjectId = subject.id;
    }
    const { data: tutor, error: tutorError } = await database.from("staff").select("email").eq("id", tutorId).single();
    if (tutorError || !tutor.email) throw tutorError ?? new Error("Seeded Tutor required");
    await write(user.auth.signInWithPassword({ email: tutor.email, password: "test-password" }));
    await write(database.from("interviews").insert({ id: interviewId, data: {} }));
    const now = new Date().toISOString();
    state = {
      name: "Large recording contract", delivery: "online", mode: "feedback", recordingEnabled: true,
      startedAt: now, phase: "questions", phaseStartedAt: now, pausedAt: null, rotation: 0,
      phaseDeadline: new Date(Date.now() + 20 * 60_000).toISOString(), questionTimeSeconds: 1200,
      tutors: [{ id: tutorId, name: "Tutor" }], students: [{ id: studentId, name: "Student" }],
      stations: [{ id: stationId, questions: [] }], assignments: [{ stationId, tutorId }],
      progress: [{ stationId, tutorId, studentId, feedbackComplete: false, endedEarly: false }],
      attempts: [{ id: attemptId, stationId, studentId, feedback: [] }],
    };
    await write(database.from("interview_rounds").insert({ id: roundId, interview_id: interviewId, created_by: tutorId, tutor_ids: [tutorId], student_ids: [studentId], data: state }));
  });
  afterAll(async () => {
    if (!verifiedLocal) return;
    if (storagePath) await write(database.storage.from("interview-recordings").remove([storagePath]));
    await write(database.from("interview_recordings").delete().eq("round_id", roundId));
    await write(database.from("interview_media_sessions").delete().eq("round_id", roundId));
    await write(database.from("interview_rounds").delete().eq("id", roundId));
    await write(database.from("interviews").delete().eq("id", interviewId));
    if (createdSubjectId) await write(database.from("staff_subjects").delete().eq("staff_id", tutorId).eq("subject_id", createdSubjectId));
    await user.auth.signOut({ scope: "local" });
  });

  it("stores a fifteen-minute-equivalent take immutably and keeps consent and playback authorization", async () => {
    const ticketResponse = await handlers.ticket(new Request("http://localhost/media?capture=1"), roundId);
    expect(ticketResponse.status).toBe(200);
    const ticket = await ticketResponse.json() as { captureId: string };
    const endpoint = `http://localhost/api/interviews/rounds/${roundId}/recordings/audio?captureId=${ticket.captureId}&segmentId=${ticket.captureId}`;
    // This tests byte capacity, not codec validity. Actual browser-produced media
    // is decoded separately; this opaque body represents 15 minutes at 1.064 Mbps.
    const byteLength = 119_700_000;
    const metadata = { contentType: "video/webm", byteLength, startedAt: new Date().toISOString() };
    const request = (action: "prepare" | "complete") => new Request(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...metadata, action }),
    });
    await write(database.from("interview_rounds").update({ data: { ...state, recordingEnabled: false } }).eq("id", roundId));
    expect((await handlers.uploadAudio(request("prepare"), roundId)).status).toBe(403);
    await write(database.from("interview_rounds").update({ data: state }).eq("id", roundId));
    const prepared = await handlers.uploadAudio(request("prepare"), roundId);
    expect(prepared.status).toBe(200);
    const { uploadUrl } = await prepared.json() as { uploadUrl: string };
    storagePath = `${roundId}/${ticket.captureId}/${ticket.captureId}.webm`;
    const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/webm" }, body: new Uint8Array(byteLength) });
    expect(upload.status).toBe(200);
    expect((await handlers.uploadAudio(request("complete"), roundId)).status).toBe(200);
    const playback = await handlers.recording(new Request("http://localhost/recording"), roundId, ticket.captureId);
    expect(playback.status).toBe(200);
    const { url } = await playback.json() as { url: string };
    const stored = await fetch(url);
    expect(stored.status).toBe(200);
    expect((await stored.arrayBuffer()).byteLength).toBe(119_700_000);
    const replay = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/webm" }, body: new Uint8Array([1, 2, 3]) });
    expect(replay.ok).toBe(false);
    await write(database.from("interview_rounds").update({ tutor_ids: [], created_by: "00000000-0000-0000-0000-000000000011" }).eq("id", roundId));
    expect((await handlers.recording(new Request("http://localhost/recording"), roundId, ticket.captureId)).status).toBe(404);
  }, 60_000);
});
