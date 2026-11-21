import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/generated";
import { createInterviewMediaHandlers } from "../server/http";

const roundId = "10000000-0000-4000-8000-000000000001";
const tutorId = "10000000-0000-4000-8000-000000000003";
const studentId = "10000000-0000-4000-8000-000000000004";
const now = new Date().toISOString();

it.each(["tutor", "student"] as const)("authorizes a %s media ticket without reading the rich round", async (role) => {
  const actorId = role === "tutor" ? tutorId : studentId;
  const round = {
    id: roundId, version: 1, delivery: "in_person", mode: "feedback", phase: "questions",
    startedAt: now, phaseStartedAt: now, phaseDeadline: new Date(Date.now() + 60_000).toISOString(), pausedAt: null,
    recordingEnabled: true, serverNow: now, recordings: [],
    progress: [{ stationId: "station", tutorId, studentId }],
    attempts: [{ id: "attempt", stationId: "station", studentId }],
    tutors: [{ id: tutorId, name: "Tutor" }], students: [{ id: studentId, name: "Student" }],
  };
  const user = {
    from: (view: string) => {
      if (view !== `v${role}_interview_media_access`) throw new Error("Rich round access is unavailable");
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: { id: roundId, delivery: "in_person", actor_id: actorId }, error: null }) };
      return query;
    },
    rpc: async () => { throw new Error("No extra profile round trip"); },
  } as unknown as SupabaseClient<Database>;
  const client = { rpc: async () => ({ data: round, error: null }) } as unknown as SupabaseClient<Database>;
  const handlers = createInterviewMediaHandlers({ role,
    resolveActor: async () => ({ userId: "user", userClient: user }), serviceClient: () => client,
    apiKey: () => undefined, errorResponse: () => Response.json({ error: "Unavailable" }, { status: 500 }),
  });
  const response = await handlers.ticket(new Request(`https://portal.test/api/interviews/rounds/${roundId}/media`), roundId);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(await response.json()).toMatchObject({ actorId: "user", sessionId: null, canSend: false,
    canReceive: false, attemptId: "attempt", recordingEnabled: role === "tutor", phase: "questions" });
});
