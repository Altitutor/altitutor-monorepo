import { isInterviewCommand, type Json } from "@altitutor/shared";
import { reconcileInterviewMedia } from '@altitutor/shared/interviews/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import {
  createInterviewServiceClient,
  interviewApiError,
  interviewResponse,
  readInterviewCommandBody,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
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
    const service = createInterviewServiceClient();
    const { data, error } = await service.rpc(
      "interview_command",
      {
        p_actor_user_id: actor.userId,
        p_command: body as unknown as Json,
      },
    );
    if (error) throw error;
    if (process.env.DAILY_API_KEY && 'roundId' in body && ['pause','resume','next','endStation','finishFeedback','startReading'].includes(body.type)) {
      try {
        await reconcileInterviewMedia(service, process.env.DAILY_API_KEY, body.roundId);
      } catch (mediaError) {
        captureApiError(mediaError, '/api/interviews/commands/media');
        return interviewResponse({ ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}), mediaWarning: 'Interview state saved, but video shutdown could not be confirmed. Disconnect your call; the server will retry.' });
      }
    }
    return interviewResponse(data);
  } catch (error) {
    return interviewApiError(error);
  }
}
