import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export function GET(request: Request, context: { params: { roundId: string } }) {
  return interviewMediaHandlers.ticket(request, context.params.roundId);
}
