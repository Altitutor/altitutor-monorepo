import type { Database } from '@altitutor/shared';

export const STUDENT_WELCOME_TOUR = 'student-welcome';

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

/**
 * Shape of each entry in `students.onboarding_progress`:
 *   { "<tour_id>": { "completed_at": <ISO8601>, "version": <int> } }
 *
 * The DB column is a free-form JSONB but writes always go through the
 * student_complete_onboarding_tour RPC, which enforces this shape.
 */
export interface OnboardingTourState {
  completed_at: string;
  version: number;
}

export type OnboardingProgress = Record<string, OnboardingTourState>;

function asProgress(value: StudentProfile['onboarding_progress']): OnboardingProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as unknown as OnboardingProgress;
}

export function isTourCompleted(
  profile: Pick<StudentProfile, 'onboarding_progress'> | null | undefined,
  tourId: string,
): boolean {
  if (!profile) return false;
  const progress = asProgress(profile.onboarding_progress);
  const entry = progress[tourId];
  return !!entry?.completed_at;
}
