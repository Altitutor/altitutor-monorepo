import type { InterviewRound } from '@altitutor/shared';

export async function fetchAdminInterviewRound(roundId: string): Promise<InterviewRound> {
  const response = await fetch(`/api/interviews/rounds/${encodeURIComponent(roundId)}`, {cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Unable to load interview.');
  return data;
}
