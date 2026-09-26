'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { TutorDashboardUpdatesCard } from './TutorDashboardUpdatesCard';
import { TutorTodaySessionsCalendarView } from '@/features/sessions/components/TutorTodaySessionsCalendarView';
import {
  useTutorSessionsInRange,
} from '@/features/sessions/hooks/useSessionsQuery';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { LogSessionModal, UnloggedSessionsTableSection } from '@/features/tutor-logs/components';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

export interface TutorDashboardHomeProps {
  firstName: string | null;
  staffId: string | null;
}

export function TutorDashboardHome({ firstName, staffId }: TutorDashboardHomeProps) {
  const displayName = firstName?.trim() || 'Tutor';

  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionPreselectedId, setLogSessionPreselectedId] = useState<string | undefined>(
    undefined,
  );
  const [logSessionCompletedCount, setLogSessionCompletedCount] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  const handleOpenLogSession = (preselectedSessionId?: string) => {
    setLogSessionPreselectedId(preselectedSessionId);
    setIsLogSessionModalOpen(true);
  };

  const handleCloseLogSession = () => {
    const hadPreselected = !!logSessionPreselectedId;
    setIsLogSessionModalOpen(false);
    setLogSessionPreselectedId(undefined);
    if (hadPreselected) {
      setLogSessionCompletedCount((count) => count + 1);
    }
  };

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setTimeout(() => setSelectedSessionId(null), 300);
  };

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');
  const dateLabel = format(today, 'd MMMM yyyy');

  const {
    data: todaySessions = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useTutorSessionsInRange(todayStr, todayStr);

  return (
    <>
    <div className="min-h-full">
      <TutorPageContainer className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Hi, {displayName}</h1>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">{dateLabel}</p>
          </div>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Welcome to your tutor portal.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          <section aria-labelledby="todays-sessions-heading" className="md:col-span-2">
            <div className={tutorCardCn('flex flex-col overflow-hidden')}>
              <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-2 pt-3">
                <h2 id="todays-sessions-heading" className="text-lg font-semibold">
                  Today’s sessions
                </h2>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn(tutorBtnOutline, 'shrink-0')}
                >
                  <Link href="/classes" className="gap-2">
                    Timetable
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="max-h-[520px] min-h-0 overflow-auto">
                {sessionsError ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">
                    Could not load your sessions.{' '}
                    <Link
                      href="/classes"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Open timetable
                    </Link>
                  </p>
                ) : (
                  <TutorTodaySessionsCalendarView
                    date={todayStr}
                    sessions={todaySessions}
                    isLoading={sessionsLoading}
                    onOpenSession={handleOpenSession}
                  />
                )}
              </div>
            </div>
          </section>

          <TutorDashboardUpdatesCard date={todayStr} onOpenSession={handleOpenSession} />
        </div>

        {staffId ? (
          <UnloggedSessionsTableSection staffId={staffId} onLogSession={handleOpenLogSession} />
        ) : null}
      </TutorPageContainer>
    </div>

    <SessionModal
      isOpen={isSessionModalOpen}
      sessionId={selectedSessionId}
      onClose={handleCloseSessionModal}
      onLogSessionClick={() => handleOpenLogSession(selectedSessionId ?? undefined)}
      currentStaffId={staffId}
      currentStaffIdForNotes={staffId}
      refreshTrigger={logSessionCompletedCount}
    />

    {staffId ? (
      <LogSessionModal
        isOpen={isLogSessionModalOpen}
        onClose={handleCloseLogSession}
        currentStaffId={staffId}
        preselectedSessionId={logSessionPreselectedId}
      />
    ) : null}
    </>
  );
}
