'use client';

import { UnloggedSessionsTableSection } from './UnloggedSessionsTableSection';
import { PastSessionsTable } from '@/features/sessions/components/PastSessionsTable';

export type TutorLogsPanelProps = {
  staffId: string | null;
  onLogSession: (sessionId?: string) => void;
  onOpenSession: (sessionId: string) => void;
};

export function TutorLogsPanel({
  staffId,
  onLogSession,
  onOpenSession,
}: TutorLogsPanelProps) {
  return (
    <div className="space-y-8">
      {staffId ? (
        <UnloggedSessionsTableSection staffId={staffId} onLogSession={onLogSession} />
      ) : null}
      <PastSessionsTable onOpenSession={onOpenSession} />
    </div>
  );
}
