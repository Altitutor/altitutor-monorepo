import {
  createInterviewMediaStore,
  DailyInterviewProvider,
  InterviewMediaService,
} from "@altitutor/shared/interviews/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import {
  interviewResponse,
  readAdminInterviewRound,
} from "@/features/interviews/server/read";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const { roundId } = await params;
    const access = await readAdminInterviewRound(roundId);
    if (!access.ok) return access.response;
    const search = new URL(request.url).searchParams;
    const stationId = search.get("stationId");
    if (
      !stationId ||
      !access.round.stations.some((station) => station.id === stationId)
    )
      return interviewResponse(
        { error: "Select a station in this interview." },
        400,
      );
    const key = process.env.DAILY_API_KEY;
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
    return interviewResponse(
      await service.ticketObserver(
        roundId,
        { id: access.actorId, name: "Admin" },
        stationId,
        search.get("sessionId") ?? undefined,
        search.get("accessKey") ?? undefined,
      ),
    );
  } catch (error) {
    captureApiError(error, "/api/interviews/rounds/[roundId]/media");
    return interviewResponse(
      { error: "Unable to watch the station. Try again." },
      500,
    );
  }
}
