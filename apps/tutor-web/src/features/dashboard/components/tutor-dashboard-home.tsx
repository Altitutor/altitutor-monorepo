'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Calendar,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Button, ClickableNavCard } from '@altitutor/ui';
import { TutorDashboardUpdatesCard } from './TutorDashboardUpdatesCard';
import { TutorTodaySessionsCalendarView } from '@/features/sessions/components/TutorTodaySessionsCalendarView';
import {
  useTutorSessionsInRange,
} from '@/features/sessions/hooks/useSessionsQuery';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { LogSessionModal, UnloggedSessionsTableSection } from '@/features/tutor-logs/components';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';

type QuickLinkItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const baseQuickLinks: QuickLinkItem[] = [
  {
    title: 'Classes',
    description: 'Timetable, sessions, and tutor logs',
    href: '/classes',
    icon: Calendar,
  },
  {
    title: 'Resources',
    description: 'Learning materials (coming soon)',
    href: '/resources',
    icon: BookOpen,
  },
  {
    title: 'Pay tier',
    description: 'Your pay ladder, requirements, and check-ins',
    href: '/pay-tier',
    icon: TrendingUp,
  },
  {
    title: 'Settings',
    description: 'Profile, blockout dates, and preferences',
    href: '/settings',
    icon: Settings,
  },
];

const ucatQuickLink: QuickLinkItem = {
  title: 'UCAT',
  description: 'Questions, sets, mocks, and student progress',
  href: '/ucat',
  icon: BrainCircuit,
};

export interface TutorDashboardHomeProps {
  firstName: string | null;
  staffId: string | null;
}

export function TutorDashboardHome({ firstName, staffId }: TutorDashboardHomeProps) {
  const ucatAccess = useUcatAccess();
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

  const quickLinks = ucatAccess.data
    ? [baseQuickLinks[0], ucatQuickLink, ...baseQuickLinks.slice(1)]
    : baseQuickLinks;

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

        <section aria-labelledby="quick-links-heading" className="space-y-4">
          <h2 id="quick-links-heading" className="text-2xl font-semibold">
            Quick links
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="flex min-w-0 flex-col">
                  <ClickableNavCard
                    href={item.href}
                    icon={Icon}
                    title={item.title}
                    description={item.description}
                    cardClassName={tutorCardCn()}
                  />
                </li>
              );
            })}
          </ul>
        </section>
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
