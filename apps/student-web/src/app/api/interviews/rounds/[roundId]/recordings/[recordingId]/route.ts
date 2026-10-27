import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export function GET(request: Request, context: { params: { roundId: string; recordingId: string } }) {
  return interviewMediaHandlers.recording(request, context.params.roundId, context.params.recordingId);
}
