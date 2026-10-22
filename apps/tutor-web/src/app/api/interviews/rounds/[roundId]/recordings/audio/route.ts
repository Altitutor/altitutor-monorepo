import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export function POST(request: Request, context: { params: { roundId: string } }) {
  return interviewMediaHandlers.uploadAudio(request, context.params.roundId);
}
