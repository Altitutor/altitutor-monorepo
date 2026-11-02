import { isInterviewCommand, type Json } from "@altitutor/shared";
import {
  createInterviewServiceClient,
  interviewApiError,
  interviewResponse,
  readInterviewCommandBody,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const parsed = await readInterviewCommandBody(request);
    if ("response" in parsed) return parsed.response;
    const { body } = parsed;
    if (!isInterviewCommand(body))
      return interviewResponse({ error: "Invalid interview command." }, 400);
    if (body.type !== "heartbeat" && body.type !== "tick")
      return interviewResponse(
        { error: "Students cannot change interview settings or results." },
        403,
      );
    const { data, error } = await createInterviewServiceClient().rpc(
      "interview_command",
      {
        p_actor_user_id: actor.userId,
        p_command: body as unknown as Json,
      },
    );
    if (error) throw error;
    return interviewResponse(data);
  } catch (error) {
    return interviewApiError(error);
  }
}
