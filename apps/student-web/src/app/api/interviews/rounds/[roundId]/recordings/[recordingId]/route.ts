import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(
  request: Request,
  context: { params: Promise<{ roundId: string; recordingId: string }> }
) {
  const { roundId, recordingId } = await context.params;
  const format = new URL(request.url).searchParams.get("format") === "media" ? "media" : "json";
  return interviewMediaHandlers.recording(request, roundId, recordingId, format);
}
