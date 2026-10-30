import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(
  request: Request,
  context: { params: Promise<{ roundId: string; recordingId: string }> }
) {
  return interviewMediaHandlers.recording(request, (await context.params).roundId, (await context.params).recordingId);
}
