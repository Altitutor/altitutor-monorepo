'use client';

import { useOnboardingJourneys, useOnboardingSettings } from '../api/queries';
import { Badge } from '@altitutor/ui';
import { defaultDeadlines, lifecycle, stages } from '../lib/model';
import { JourneyDetail } from './JourneyDetail';

export function StudentOnboardingSidebar({ studentId }: { studentId: string }) {
  const { data: journeys = [], isLoading, error } = useOnboardingJourneys();
  const { data: settings } = useOnboardingSettings();
  const candidates = journeys.filter(journey => journey.student_id === studentId);
  const journey = candidates.find(item => !item.closed_at) ?? candidates[0];
  return (
    <aside aria-label="Student onboarding" className="h-full w-80 shrink-0 overflow-y-auto border-l bg-background">
      <h2 className="px-5 pt-5 font-semibold">Onboarding journey</h2>
      {journey && <div className="px-5 pt-2"><Badge variant="outline">{stages[lifecycle(journey)]}</Badge></div>}
      {isLoading && <p role="status" className="p-5 text-sm">Loading onboarding…</p>}
      {error && <p role="alert" className="p-5 text-sm text-destructive">Could not load onboarding. {error.message}</p>}
      {!isLoading && !error && !journey && <p className="p-5 text-sm text-muted-foreground">No onboarding journey recorded.</p>}
      {journey && <JourneyDetail key={journey.id} inline journey={journey} onClose={() => {}} deadlines={{ ...defaultDeadlines, ...((settings?.action_business_days as Record<string, number>) ?? {}) }} />}
    </aside>
  );
}
