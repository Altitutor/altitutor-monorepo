export interface CreateStaffInterviewInput {
  interviewee_staff_id: string;
  interviewer_staff_id: string;
  start_at: string;
  end_at?: string;
  duration_minutes?: number;
}

export async function createStaffInterview(
  input: CreateStaffInterviewInput
): Promise<string> {
  const res = await fetch('/api/sessions/staff-interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interviewee_staff_id: input.interviewee_staff_id,
      interviewer_staff_id: input.interviewer_staff_id,
      start_at: input.start_at,
      end_at: input.end_at,
      duration_minutes: input.duration_minutes,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  const data = (await res.json()) as { session_id: string };
  return data.session_id;
}
