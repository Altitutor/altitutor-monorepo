import {
  createInterviewMediaStore,
  DailyInterviewProvider,
  InterviewMediaService,
} from "@altitutor/shared/interviews/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import {
  interviewResponse,
  readAdminInterviewMediaRound,
  renewAdminInterviewPresence,
} from "@/features/interviews/server/read";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const { roundId } = await params;
    const access = await readAdminInterviewMediaRound(roundId);
    if (!access.ok) return access.response;
    const search = new URL(request.url).searchParams;
    const stationId = search.get("stationId");
    if (
      (access.round.startedAt || access.round.phase !== "waiting") &&
      (!stationId || !access.round.stationIds.includes(stationId))
    )
      return interviewResponse(
        { error: "Select a station in this interview." },
        400,
      );
    const key = search.get("inactive") === "1" ? undefined : process.env.DAILY_API_KEY;
    if (!key)
      return interviewResponse({
        sessionId: null,
        canSend: false,
        canReceive: false,
        recordingEnabled: false,
        warning:
          "Online interviews are not configured. Contact your administrator.",
        serverNow: access.round.serverNow,
      });
    const service = new InterviewMediaService(
      createInterviewMediaStore(access.admin),
      new DailyInterviewProvider(key),
    );
    await renewAdminInterviewPresence(access, roundId);
    const ticket = await service.ticketObserver(
        roundId,
        { id: access.actorId, name: "Admin" },
        stationId ?? "",
        search.get("sessionId") ?? undefined,
        search.get("accessKey") ?? undefined,
      );
    // A slow provider request must not admit a caller after its lease expired
    // and deletion won. The heartbeat rechecks deletion under the same lock.
    await renewAdminInterviewPresence(access, roundId);
    return interviewResponse(ticket);
  } catch (error) {
    captureApiError(error, "/api/interviews/rounds/[roundId]/media");
    return interviewResponse(
      { error: "Unable to watch the station. Try again." },
      500,
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const { roundId } = await params;
    const access = await readAdminInterviewMediaRound(roundId);
    if (!access.ok) return access.response;
    await renewAdminInterviewPresence(access, roundId);
    return interviewResponse({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/interviews/rounds/[roundId]/media/presence");
    return interviewResponse({ error: "Unable to confirm interview participation." }, 409);
  }
}
